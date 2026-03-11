import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

import { useSettingsStore } from './setting.ts';
import { useUserStore } from './user.ts';
import { useExchangeRatesStore } from './exchangeRates.ts';
import { useAccountTagsStore } from './accountTag.ts';

import { type BeforeResolveFunction, itemAndIndex, reversed, entries, values } from '@/core/base.ts';
import type { HiddenAmount, NumberWithSuffix } from '@/core/numeral.ts';
import { AccountType, AccountCategory } from '@/core/account.ts';
import { DISPLAY_HIDDEN_AMOUNT, INCOMPLETE_AMOUNT_SUFFIX } from '@/consts/numeral.ts';

import {
    type AccountNewDisplayOrderRequest,
    type AccountDisplayBalance,
    type CategorizedAccount,
    type AccountShowingIds,
    Account
} from '@/models/account.ts';

import { isNumber, isEquals } from '@/lib/common.ts';
import { getCategorizedAccountsMap, getAllFilteredAccountsBalance } from '@/lib/account.ts';
import services from '@/lib/services.ts';
import logger from '@/lib/logger.ts';

export const useAccountsStore = defineStore('accounts', () => {
    const settingsStore = useSettingsStore();
    const userStore = useUserStore();
    const exchangeRatesStore = useExchangeRatesStore();
    const accountTagsStore = useAccountTagsStore();

    const allAccounts = ref<Account[]>([]);
    const allAccountsMap = ref<Record<string, Account>>({});
    const allCategorizedAccountsMap = ref<Record<number, CategorizedAccount>>({});
    const accountListStateInvalid = ref<boolean>(true);

    const allPlainAccounts = computed<Account[]>(() => Account.sortAccounts([...allAccounts.value], settingsStore.accountCategoryDisplayOrders));

    const allMixedPlainAccounts = computed<Account[]>(() => Account.sortAccounts([...allAccounts.value], settingsStore.accountCategoryDisplayOrders));

    const allVisiblePlainAccounts = computed<Account[]>(() => Account.sortAccounts(allAccounts.value.filter(account => !account.hidden), settingsStore.accountCategoryDisplayOrders));

    const allAvailableAccountsCount = computed<number>(() => {
        let allAccountCount = 0;

        for (const categorizedAccounts of values(allCategorizedAccountsMap.value)) {
            allAccountCount += categorizedAccounts.accounts.length;
        }

        return allAccountCount;
    });

    const allVisibleAccountsCount = computed<number>(() => {
        let shownAccountCount = 0;

        for (const categorizedAccounts of values(allCategorizedAccountsMap.value)) {
            const accountList = categorizedAccounts.accounts;

            for (const account of accountList) {
                if (!account.hidden) {
                    shownAccountCount++;
                }
            }
        }

        return shownAccountCount;
    });

    const maxCategoryAccountCount = computed<number>(() => {
        let maxCount = 0;

        for (const categorizedAccounts of values(allCategorizedAccountsMap.value)) {
            const accountCount = categorizedAccounts.accounts.length;

            if (accountCount > maxCount) {
                maxCount = accountCount;
            }
        }

        return maxCount;
    });

    function loadAccountList(accounts: Account[]): void {
        allAccounts.value = accounts;
        allAccountsMap.value = {};

        for (const account of accounts) {
            allAccountsMap.value[account.id] = account;
        }

        allCategorizedAccountsMap.value = getCategorizedAccountsMap(accounts);
    }

    function addAccountToAccountList(currentAccount: Account): void {
        const newAccountCategory = AccountCategory.valueOf(currentAccount.category);
        let insertIndexToAllList = allAccounts.value.length;

        if (newAccountCategory) {
            for (const [account, index] of itemAndIndex(allAccounts.value)) {
                const accountCategory = AccountCategory.valueOf(account.category);
                const accountCategoryDisplayOrder = settingsStore.accountCategoryDisplayOrders[accountCategory?.type ?? 0] || Number.MAX_SAFE_INTEGER;
                const newAccountCategoryDisplayOrder = settingsStore.accountCategoryDisplayOrders[newAccountCategory.type] || Number.MAX_SAFE_INTEGER;

                if (accountCategory && accountCategoryDisplayOrder > newAccountCategoryDisplayOrder) {
                    insertIndexToAllList = index;
                    break;
                }
            }
        }

        allAccounts.value.splice(insertIndexToAllList, 0, currentAccount);

        allAccountsMap.value[currentAccount.id] = currentAccount;

        if (allCategorizedAccountsMap.value[currentAccount.category]) {
            const accountList = allCategorizedAccountsMap.value[currentAccount.category]!.accounts;
            accountList.push(currentAccount);
        } else {
            allCategorizedAccountsMap.value = getCategorizedAccountsMap(allAccounts.value);
        }
    }

    function updateAccountToAccountList(oldAccount: Account, newAccount: Account): void {
        for (const [account, index] of itemAndIndex(allAccounts.value)) {
            if (account.id === newAccount.id) {
                allAccounts.value.splice(index, 1, newAccount);
                break;
            }
        }

        allAccountsMap.value[newAccount.id] = newAccount;

        if (allCategorizedAccountsMap.value[newAccount.category]) {
            const accountList = allCategorizedAccountsMap.value[newAccount.category]!.accounts;

            for (const [account, index] of itemAndIndex(accountList)) {
                if (account.id === newAccount.id) {
                    accountList.splice(index, 1, newAccount);
                    break;
                }
            }
        }
    }

    function updateAccountDisplayOrderInAccountList({ account, from, to, updateListOrder, updateGlobalListOrder }: { account: Account, from: number, to: number, updateListOrder: boolean, updateGlobalListOrder: boolean }): void {
        let fromAccount = null;
        let toAccount = null;

        if (allCategorizedAccountsMap.value[account.category]) {
            const accountList = allCategorizedAccountsMap.value[account.category]!.accounts;

            if (updateListOrder) {
                fromAccount = accountList[from];
                toAccount = accountList[to];
                accountList.splice(to, 0, accountList.splice(from, 1)[0] as Account);
            } else {
                fromAccount = accountList[to];

                if (from < to) {
                    toAccount = accountList[to - 1];
                } else if (from > to) {
                    toAccount = accountList[to + 1];
                }
            }
        }

        if (updateGlobalListOrder && fromAccount && toAccount) {
            let globalFromIndex = -1;
            let globalToIndex = -1;

            for (const [account, index] of itemAndIndex(allAccounts.value)) {
                if (account.id === fromAccount.id) {
                    globalFromIndex = index;
                } else if (account.id === toAccount.id) {
                    globalToIndex = index;
                }
            }

            if (globalFromIndex >= 0 && globalToIndex >= 0) {
                allAccounts.value.splice(globalToIndex, 0, allAccounts.value.splice(globalFromIndex, 1)[0] as Account);
            }
        }
    }

    function updateAccountVisibilityInAccountList({ account, hidden }: { account: Account, hidden: boolean }): void {
        if (allAccountsMap.value[account.id]) {
            allAccountsMap.value[account.id]!.visible = !hidden;
        }
    }

    function removeAccountFromAccountList(currentAccount: Account): void {
        for (const [account, index] of itemAndIndex(allAccounts.value)) {
            if (account.id === currentAccount.id) {
                allAccounts.value.splice(index, 1);
                break;
            }
        }

        if (allAccountsMap.value[currentAccount.id]) {
            delete allAccountsMap.value[currentAccount.id];
        }

        if (allCategorizedAccountsMap.value[currentAccount.category]) {
            const accountList = allCategorizedAccountsMap.value[currentAccount.category]!.accounts;

            for (const [account, index] of itemAndIndex(accountList)) {
                if (account.id === currentAccount.id) {
                    accountList.splice(index, 1);
                    break;
                }
            }
        }
    }

    function updateAccountListInvalidState(invalidState: boolean): void {
        accountListStateInvalid.value = invalidState;
    }

    function resetAccounts(): void {
        allAccounts.value = [];
        allAccountsMap.value = {};
        allCategorizedAccountsMap.value = {};
        accountListStateInvalid.value = true;
    }

    function getFirstShowingIds(showHidden: boolean): AccountShowingIds {
        const ret: AccountShowingIds = {
            accounts: {}
        };

        for (const [category, categorizedAccounts] of entries(allCategorizedAccountsMap.value)) {
            if (!categorizedAccounts || !categorizedAccounts.accounts) {
                continue;
            }

            const accounts = categorizedAccounts.accounts;

            for (const account of accounts) {
                if (showHidden || !account.hidden) {
                    ret.accounts[parseInt(category)] = account.id;
                    break;
                }
            }
        }

        return ret;
    }

    function getLastShowingIds(showHidden: boolean): AccountShowingIds {
        const ret: AccountShowingIds = {
            accounts: {}
        };

        for (const [category, categorizedAccounts] of entries(allCategorizedAccountsMap.value)) {
            if (!categorizedAccounts || !categorizedAccounts.accounts) {
                continue;
            }

            const accounts = categorizedAccounts.accounts;

            for (const account of reversed(accounts)) {
                if (showHidden || !account.hidden) {
                    ret.accounts[parseInt(category)] = account.id;
                    break;
                }
            }
        }

        return ret;
    }

    function getAccountStatementDate(accountId?: string): number | undefined | null {
        if (!accountId) {
            return null;
        }

        const accountIds = accountId.split(',');
        let mainAccount = null;

        for (const accountId of accountIds) {
            const account = allAccountsMap.value[accountId];

            if (!account) {
                return null;
            }

            if (mainAccount) {
                if (mainAccount.id !== account.id) {
                    return null;
                } else {
                    continue;
                }
            }

            mainAccount = account;
        }

        if (!mainAccount) {
            return null;
        }

        if (mainAccount.category === AccountCategory.CreditCard.type) {
            return mainAccount.creditCardStatementDate;
        }

        return null;
    }

    function getTotalAmountTargetCurrency(): string {
        return settingsStore.appSettings.totalAmountTargetCurrency || userStore.currentUserDefaultCurrency;
    }

    function isAccountExcludedByTag(account: Account): boolean {
        const excludeTagIds = settingsStore.appSettings.totalAmountExcludeAccountTagIds;

        if (!excludeTagIds || Object.keys(excludeTagIds).length < 1) {
            return false;
        }

        const accountTagNames = account.tags && account.tags.length ? account.tags : (account.tag ? [account.tag] : []);

        for (const rawTagName of accountTagNames) {
            const tagName = rawTagName?.trim();

            if (!tagName) {
                continue;
            }

            const tag = accountTagsStore.allAccountTagsNameMap[tagName];

            if (tag && excludeTagIds[tag.id]) {
                return true;
            }
        }

        return false;
    }

    function getNetAssets(showAccountBalance: boolean): number | HiddenAmount | NumberWithSuffix {
        if (!showAccountBalance) {
            return DISPLAY_HIDDEN_AMOUNT;
        }

        const targetCurrency = getTotalAmountTargetCurrency();
        const accountsBalance = getAllFilteredAccountsBalance(allCategorizedAccountsMap.value, settingsStore.appSettings.accountCategoryOrders,
                account => !(account.type === AccountType.SingleAccount.type && settingsStore.appSettings.totalAmountExcludeAccountIds[account.id]) && !isAccountExcludedByTag(account)
        );
        let netAssets = 0;
        let hasUnCalculatedAmount = false;

        for (const accountBalance of accountsBalance) {
            if (accountBalance.currency === targetCurrency) {
                netAssets += accountBalance.balance;
            } else {
                const balance = exchangeRatesStore.getExchangedAmount(accountBalance.balance, accountBalance.currency, targetCurrency);

                if (!isNumber(balance)) {
                    hasUnCalculatedAmount = true;
                    continue;
                }

                netAssets += Math.trunc(balance);
            }
        }

        if (hasUnCalculatedAmount) {
            return {
                value: netAssets,
                suffix: INCOMPLETE_AMOUNT_SUFFIX
            };
        } else {
            return netAssets;
        }
    }

    function getNetAssetsByCurrency(showAccountBalance: boolean): Record<string, number | HiddenAmount> {
        const accountsBalance = getAllFilteredAccountsBalance(allCategorizedAccountsMap.value, settingsStore.appSettings.accountCategoryOrders,
                account => !(account.type === AccountType.SingleAccount.type && settingsStore.appSettings.totalAmountExcludeAccountIds[account.id]) && !isAccountExcludedByTag(account)
        );
        const ret: Record<string, number | HiddenAmount> = {};

        for (const accountBalance of accountsBalance) {
            const currency = accountBalance.currency;

            if (!currency) {
                continue;
            }

            if (!showAccountBalance) {
                ret[currency] = DISPLAY_HIDDEN_AMOUNT;
                continue;
            }

            if (!isNumber(ret[currency])) {
                ret[currency] = 0;
            }

            ret[currency] = (ret[currency] as number) + accountBalance.balance;
        }

        return ret;
    }

    function getTotalAssets(showAccountBalance: boolean): number | HiddenAmount | NumberWithSuffix {
        if (!showAccountBalance) {
            return DISPLAY_HIDDEN_AMOUNT;
        }

        const targetCurrency = getTotalAmountTargetCurrency();
        const accountsBalance = getAllFilteredAccountsBalance(allCategorizedAccountsMap.value, settingsStore.appSettings.accountCategoryOrders,
                account => (account.isAsset || false) && !(account.type === AccountType.SingleAccount.type && settingsStore.appSettings.totalAmountExcludeAccountIds[account.id]) && !isAccountExcludedByTag(account)
        );
        let totalAssets = 0;
        let hasUnCalculatedAmount = false;

        for (const accountBalance of accountsBalance) {
            if (accountBalance.currency === targetCurrency) {
                totalAssets += accountBalance.balance;
            } else {
                const balance = exchangeRatesStore.getExchangedAmount(accountBalance.balance, accountBalance.currency, targetCurrency);

                if (!isNumber(balance)) {
                    hasUnCalculatedAmount = true;
                    continue;
                }

                totalAssets += Math.trunc(balance);
            }
        }

        if (hasUnCalculatedAmount) {
            return {
                value: totalAssets,
                suffix: INCOMPLETE_AMOUNT_SUFFIX
            };
        } else {
            return totalAssets;
        }
    }

    function getTotalAssetsByCurrency(showAccountBalance: boolean): Record<string, number | HiddenAmount> {
        const accountsBalance = getAllFilteredAccountsBalance(allCategorizedAccountsMap.value, settingsStore.appSettings.accountCategoryOrders,
                account => (account.isAsset || false) && !(account.type === AccountType.SingleAccount.type && settingsStore.appSettings.totalAmountExcludeAccountIds[account.id]) && !isAccountExcludedByTag(account)
        );
        const ret: Record<string, number | HiddenAmount> = {};

        for (const accountBalance of accountsBalance) {
            const currency = accountBalance.currency;

            if (!currency) {
                continue;
            }

            if (!showAccountBalance) {
                ret[currency] = DISPLAY_HIDDEN_AMOUNT;
                continue;
            }

            if (!isNumber(ret[currency])) {
                ret[currency] = 0;
            }

            ret[currency] = (ret[currency] as number) + accountBalance.balance;
        }

        return ret;
    }

    function getTotalLiabilities(showAccountBalance: boolean): number | HiddenAmount | NumberWithSuffix {
        if (!showAccountBalance) {
            return DISPLAY_HIDDEN_AMOUNT;
        }

        const targetCurrency = getTotalAmountTargetCurrency();
        const accountsBalance = getAllFilteredAccountsBalance(allCategorizedAccountsMap.value, settingsStore.appSettings.accountCategoryOrders,
                account => (account.isLiability || false) && !(account.type === AccountType.SingleAccount.type && settingsStore.appSettings.totalAmountExcludeAccountIds[account.id]) && !isAccountExcludedByTag(account)
        );
        let totalLiabilities = 0;
        let hasUnCalculatedAmount = false;

        for (const accountBalance of accountsBalance) {
            if (accountBalance.currency === targetCurrency) {
                totalLiabilities -= accountBalance.balance;
            } else {
                const balance = exchangeRatesStore.getExchangedAmount(accountBalance.balance, accountBalance.currency, targetCurrency);

                if (!isNumber(balance)) {
                    hasUnCalculatedAmount = true;
                    continue;
                }

                totalLiabilities -= Math.trunc(balance);
            }
        }

        if (hasUnCalculatedAmount) {
            return {
                value: totalLiabilities,
                suffix: INCOMPLETE_AMOUNT_SUFFIX
            };
        } else {
            return totalLiabilities;
        }
    }

    function getTotalLiabilitiesByCurrency(showAccountBalance: boolean): Record<string, number | HiddenAmount> {
        const accountsBalance = getAllFilteredAccountsBalance(allCategorizedAccountsMap.value, settingsStore.appSettings.accountCategoryOrders,
                account => (account.isLiability || false) && !(account.type === AccountType.SingleAccount.type && settingsStore.appSettings.totalAmountExcludeAccountIds[account.id]) && !isAccountExcludedByTag(account)
        );
        const ret: Record<string, number | HiddenAmount> = {};

        for (const accountBalance of accountsBalance) {
            const currency = accountBalance.currency;

            if (!currency) {
                continue;
            }

            if (!showAccountBalance) {
                ret[currency] = DISPLAY_HIDDEN_AMOUNT;
                continue;
            }

            if (!isNumber(ret[currency])) {
                ret[currency] = 0;
            }

            ret[currency] = (ret[currency] as number) - accountBalance.balance;
        }

        return ret;
    }

    function getAccountCategoryTotalBalance(showAccountBalance: boolean, accountCategory: AccountCategory): number | HiddenAmount | NumberWithSuffix {
        if (!showAccountBalance) {
            return DISPLAY_HIDDEN_AMOUNT;
        }

        const targetCurrency = getTotalAmountTargetCurrency();
        const accountsBalance = getAllFilteredAccountsBalance(allCategorizedAccountsMap.value, settingsStore.appSettings.accountCategoryOrders,
                account => account.category === accountCategory.type);
        let totalBalance = 0;
        let hasUnCalculatedAmount = false;

        for (const accountBalance of accountsBalance) {
            if (accountBalance.currency === targetCurrency) {
                if (accountBalance.isAsset) {
                    totalBalance += accountBalance.balance;
                } else if (accountBalance.isLiability) {
                    totalBalance -= accountBalance.balance;
                } else {
                    totalBalance += accountBalance.balance;
                }
            } else {
                const balance = exchangeRatesStore.getExchangedAmount(accountBalance.balance, accountBalance.currency, targetCurrency);

                if (!isNumber(balance)) {
                    hasUnCalculatedAmount = true;
                    continue;
                }

                if (accountBalance.isAsset) {
                    totalBalance += Math.trunc(balance);
                } else if (accountBalance.isLiability) {
                    totalBalance -= Math.trunc(balance);
                } else {
                    totalBalance += Math.trunc(balance);
                }
            }
        }

        if (hasUnCalculatedAmount) {
            return {
                value: totalBalance,
                suffix: INCOMPLETE_AMOUNT_SUFFIX
            };
        } else {
            return totalBalance;
        }
    }

    function getAccountBalance(showAccountBalance: boolean, account: Account): number | HiddenAmount | null {
        if (account.type !== AccountType.SingleAccount.type) {
            return null;
        }

        if (showAccountBalance) {
            if (account.isAsset) {
                return account.balance;
            } else if (account.isLiability) {
                return -account.balance;
            } else {
                return account.balance;
            }
        } else {
            return DISPLAY_HIDDEN_AMOUNT;
        }
    }

    function getAccountSubAccountBalance(showAccountBalance: boolean, account: Account): AccountDisplayBalance | null {
        const balance = getAccountBalance(showAccountBalance, account);

        if (balance === null) {
            return null;
        }

        return {
            balance,
            currency: account.currency
        };
    }

    function hasAccount(accountCategory: AccountCategory, visibleOnly: boolean): boolean {
        const categorizedAccounts = allCategorizedAccountsMap.value[accountCategory.type];

        if (!categorizedAccounts || !categorizedAccounts.accounts || !categorizedAccounts.accounts.length) {
            return false;
        }

        let shownCount = 0;

        for (const account of categorizedAccounts.accounts) {
            if (!visibleOnly || !account.hidden) {
                shownCount++;
            }
        }

        return shownCount > 0;
    }

    function hasVisibleSubAccount(): boolean {
        return false;
    }

    function loadAllAccounts({ force }: { force: boolean }): Promise<Account[]> {
        if (!force && !accountListStateInvalid.value) {
            return new Promise((resolve) => {
                resolve(allAccounts.value);
            });
        }

        return new Promise((resolve, reject) => {
            services.getAllAccounts({
                visibleOnly: false
            }).then(response => {
                const data = response.data;

                if (!data || !data.success || !data.result) {
                    reject({ message: 'Unable to retrieve account list' });
                    return;
                }

                if (accountListStateInvalid.value) {
                    updateAccountListInvalidState(false);
                }

                const accounts = Account.sortAccounts(Account.ofMulti(data.result), settingsStore.accountCategoryDisplayOrders);

                if (force && data.result && isEquals(allAccounts.value, accounts)) {
                    reject({ message: 'Account list is up to date', isUpToDate: true });
                    return;
                }

                loadAccountList(accounts);

                resolve(accounts);
            }).catch(error => {
                if (force) {
                    logger.error('failed to force load account list', error);
                } else {
                    logger.error('failed to load account list', error);
                }

                if (error.response && error.response.data && error.response.data.errorMessage) {
                    reject({ error: error.response.data });
                } else if (!error.processed) {
                    reject({ message: 'Unable to retrieve account list' });
                } else {
                    reject(error);
                }
            });
        });
    }

    function getAccount({ accountId }: { accountId: string }): Promise<Account> {
        return new Promise((resolve, reject) => {
            services.getAccount({
                id: accountId
            }).then(response => {
                const data = response.data;

                if (!data || !data.success || !data.result) {
                    reject({ message: 'Unable to retrieve account' });
                    return;
                }

                const account = Account.of(data.result);

                resolve(account);
            }).catch(error => {
                logger.error('failed to load account info', error);

                if (error.response && error.response.data && error.response.data.errorMessage) {
                    reject({ error: error.response.data });
                } else if (!error.processed) {
                    reject({ message: 'Unable to retrieve account' });
                } else {
                    reject(error);
                }
            });
        });
    }

    function saveAccount({ account, isEdit, clientSessionId }: { account: Account, isEdit: boolean, clientSessionId: string }): Promise<Account> {
        return new Promise((resolve, reject) => {
            const oldAccount = isEdit ? allAccountsMap.value[account.id] : null;
            let promise = null;

            if (!isEdit) {
                promise = services.addAccount(account.toCreateRequest(clientSessionId));
            } else {
                promise = services.modifyAccount(account.toModifyRequest(clientSessionId));
            }

            promise.then(response => {
                const data = response.data;

                if (!data || !data.success || !data.result) {
                    if (!isEdit) {
                        reject({ message: 'Unable to add account' });
                    } else {
                        reject({ message: 'Unable to save account' });
                    }
                    return;
                }

                const newAccount = Account.of(data.result);

                if (!isEdit) {
                    addAccountToAccountList(newAccount);
                } else {
                    if (oldAccount && oldAccount.category === newAccount.category) {
                        updateAccountToAccountList(oldAccount, newAccount);
                    } else {
                        updateAccountListInvalidState(true);
                    }
                }

                resolve(newAccount);
            }).catch(error => {
                logger.error('failed to save account', error);

                if (error.response && error.response.data && error.response.data.errorMessage) {
                    reject({ error: error.response.data });
                } else if (!error.processed) {
                    if (!isEdit) {
                        reject({ message: 'Unable to add account' });
                    } else {
                        reject({ message: 'Unable to save account' });
                    }
                } else {
                    reject(error);
                }
            });
        });
    }

    function changeAccountDisplayOrder({ accountId, from, to, updateListOrder, updateGlobalListOrder }: { accountId: string, from: number, to: number, updateListOrder: boolean, updateGlobalListOrder: boolean }): Promise<void> {
        const account = allAccountsMap.value[accountId];

        return new Promise((resolve, reject) => {
            if (!account ||
                !allCategorizedAccountsMap.value[account.category] ||
                !allCategorizedAccountsMap.value[account.category]!.accounts ||
                !allCategorizedAccountsMap.value[account.category]!.accounts[to]) {
                reject({ message: 'Unable to move account' });
                return;
            }

            if (!accountListStateInvalid.value) {
                updateAccountListInvalidState(true);
            }

            updateAccountDisplayOrderInAccountList({ account, from, to, updateListOrder, updateGlobalListOrder });

            resolve();
        });
    }

    function updateAccountDisplayOrders(): Promise<boolean> {
        const newDisplayOrders: AccountNewDisplayOrderRequest[] = [];

        for (const categorizedAccounts of values(allCategorizedAccountsMap.value)) {
            for (const [account, index] of itemAndIndex(categorizedAccounts.accounts)) {
                newDisplayOrders.push({
                    id: account.id,
                    displayOrder: index + 1
                });
            }
        }

        return new Promise((resolve, reject) => {
            services.moveAccount({
                newDisplayOrders: newDisplayOrders
            }).then(response => {
                const data = response.data;

                if (!data || !data.success || !data.result) {
                    reject({ message: 'Unable to move account' });
                    return;
                }

                loadAllAccounts({ force: false }).finally(() => {
                    if (accountListStateInvalid.value) {
                        updateAccountListInvalidState(false);
                    }

                    resolve(data.result);
                });
            }).catch(error => {
                logger.error('failed to save accounts display order', error);

                if (error.response && error.response.data && error.response.data.errorMessage) {
                    reject({ error: error.response.data });
                } else if (!error.processed) {
                    reject({ message: 'Unable to move account' });
                } else {
                    reject(error);
                }
            });
        });
    }

    function hideAccount({ account, hidden }: { account: Account, hidden: boolean }): Promise<boolean> {
        return new Promise((resolve, reject) => {
            services.hideAccount({
                id: account.id,
                hidden: hidden
            }).then(response => {
                const data = response.data;

                if (!data || !data.success || !data.result) {
                    if (hidden) {
                        reject({ message: 'Unable to hide this account' });
                    } else {
                        reject({ message: 'Unable to unhide this account' });
                    }

                    return;
                }

                updateAccountVisibilityInAccountList({ account, hidden });

                resolve(data.result);
            }).catch(error => {
                logger.error('failed to change account visibility', error);

                if (error.response && error.response.data && error.response.data.errorMessage) {
                    reject({ error: error.response.data });
                } else if (!error.processed) {
                    if (hidden) {
                        reject({ message: 'Unable to hide this account' });
                    } else {
                        reject({ message: 'Unable to unhide this account' });
                    }
                } else {
                    reject(error);
                }
            });
        });
    }

    function deleteAccount({ account, beforeResolve }: { account: Account, beforeResolve?: BeforeResolveFunction }): Promise<boolean> {
        return new Promise((resolve, reject) => {
            services.deleteAccount({
                id: account.id
            }).then(response => {
                const data = response.data;

                if (!data || !data.success || !data.result) {
                    reject({ message: 'Unable to delete this account' });
                    return;
                }

                if (beforeResolve) {
                    beforeResolve(() => {
                        removeAccountFromAccountList(account);
                    });
                } else {
                    removeAccountFromAccountList(account);
                }

                resolve(data.result);
            }).catch(error => {
                logger.error('failed to delete account', error);

                if (error.response && error.response.data && error.response.data.errorMessage) {
                    reject({ error: error.response.data });
                } else if (!error.processed) {
                    reject({ message: 'Unable to delete this account' });
                } else {
                    reject(error);
                }
            });
        });
    }

    return {
        // states
        allAccounts,
        allAccountsMap,
        allCategorizedAccountsMap,
        accountListStateInvalid,
        // computed states
        allPlainAccounts,
        allMixedPlainAccounts,
        allVisiblePlainAccounts,
        allAvailableAccountsCount,
        allVisibleAccountsCount,
        maxCategoryAccountCount,
        // functions
        updateAccountListInvalidState,
        resetAccounts,
        getFirstShowingIds,
        getLastShowingIds,
        getAccountStatementDate,
        getTotalAmountTargetCurrency,
        getNetAssets,
        getNetAssetsByCurrency,
        getTotalAssets,
        getTotalAssetsByCurrency,
        getTotalLiabilities,
        getTotalLiabilitiesByCurrency,
        getAccountCategoryTotalBalance,
        getAccountBalance,
        getAccountSubAccountBalance,
        hasAccount,
        hasVisibleSubAccount,
        loadAllAccounts,
        getAccount,
        saveAccount,
        changeAccountDisplayOrder,
        updateAccountDisplayOrders,
        hideAccount,
        deleteAccount
    }
});
