<template>
    <f7-page :ptr="!sortable" @ptr:refresh="reload" @page:afterin="onPageAfterIn">
        <f7-navbar>
            <f7-nav-left :class="{ 'disabled': loading }" :back-link="tt('Back')" v-if="!sortable"></f7-nav-left>
            <f7-nav-left v-else-if="sortable">
                <f7-link icon-f7="xmark" :class="{ 'disabled': displayOrderSaving }" @click="cancelSort"></f7-link>
            </f7-nav-left>
            <f7-nav-title :title="tt('Account List')"></f7-nav-title>
            <f7-nav-right :class="{ 'navbar-compact-icons': true, 'disabled': loading }">
                <f7-link icon-f7="ellipsis" :class="{ 'disabled': !allAccountCount || sortable }" @click="showMoreActionSheet = true"></f7-link>
                <f7-link icon-f7="plus" href="/account/add" v-if="!sortable"></f7-link>
                <f7-link icon-f7="checkmark_alt" :class="{ 'disabled': displayOrderSaving || !displayOrderModified }" @click="saveSortResult" v-else-if="sortable"></f7-link>
            </f7-nav-right>
        </f7-navbar>

        <f7-card class="account-overview-card" :class="{ 'skeleton-text': loading }">
            <f7-card-header class="display-block" style="padding-top: 120px;">
                <p class="no-margin">
                    <small class="card-header-content" v-if="loading">Net assets</small>
                    <small class="card-header-content" v-else-if="!loading">{{ tt('Net assets') }}</small>
                </p>
                <p class="no-margin">
                    <span class="net-assets" v-if="loading">0.00 USD</span>
                    <span class="net-assets" v-else-if="!loading">
                        <span class="net-assets-line" :key="item.currency" v-for="item in netAssetsDisplayItems">
                            <span class="net-assets-amount">{{ item.amount }}</span>
                            <span class="net-assets-currency">{{ item.currencyName }}</span>
                        </span>
                    </span>
                    <f7-link class="display-inline-flex margin-inline-start-half" @click="showAccountBalance = !showAccountBalance">
                        <f7-icon class="ebk-hide-icon" :f7="showAccountBalance ? 'eye_slash_fill' : 'eye_fill'"></f7-icon>
                    </f7-link>
                </p>
                <p class="no-margin">
                    <small class="account-overview-info" v-if="loading">
                        <span>Total assets | Total liabilities</span>
                    </small>
                    <span class="account-overview-info" v-else-if="!loading">
                        <span class="account-overview-section">
                            <span class="account-overview-section-label">{{ tt('Total assets') }}</span>
                            <span class="account-overview-section-values">
                                <span class="account-overview-value" :key="item.currency" v-for="item in totalAssetsDisplayItems">
                                    <span class="account-overview-amount">{{ item.amount }}</span>
                                    <span class="account-overview-currency">{{ item.currencyName }}</span>
                                </span>
                            </span>
                        </span>
                        <span class="account-overview-section">
                            <span class="account-overview-section-label">{{ tt('Total liabilities') }}</span>
                            <span class="account-overview-section-values">
                                <span class="account-overview-value" :key="item.currency" v-for="item in totalLiabilitiesDisplayItems">
                                    <span class="account-overview-amount">{{ item.amount }}</span>
                                    <span class="account-overview-currency">{{ item.currencyName }}</span>
                                </span>
                            </span>
                        </span>
                    </span>
                </p>
                <p class="no-margin account-overview-info mt-2" v-if="!loading">
                    <span>{{ tt('Total Currency') }}</span>
                </p>
                <div class="account-total-currency-chips" v-if="!loading">
                    <f7-chip
                        outline
                        :text="getCurrencyDisplayName(currency)"
                        :key="currency"
                        :class="{ 'chip-selected': currency === totalAmountTargetCurrency }"
                        v-for="currency in totalAmountCurrencyOptions"
                        @click="setTotalAmountTargetCurrency(currency)"
                    ></f7-chip>
                </div>
                <div class="account-total-filter-link" v-if="!loading">
                    <f7-link @click="setAccountsIncludedInTotal()">{{ tt('Accounts Included in Total') }}</f7-link>
                    <f7-link class="margin-inline-start-half" @click="setAccountTagsIncludedInTotal()">{{ tt('Filter Account Tags') }}</f7-link>
                </div>
            </f7-card-header>
        </f7-card>

        <div class="skeleton-text" v-if="loading">
            <f7-list strong inset dividers sortable class="list-has-group-title account-list margin-vertical"
                     :key="listIdx" v-for="listIdx in [ 1, 2, 3 ]">
                <f7-list-item group-title :sortable="false">
                    <small>
                        <span>Account Category</span>
                        <span style="margin-inline-start: 10px">0.00 USD</span>
                    </small>
                </f7-list-item>
                <f7-list-item class="nested-list-item" after="0.00 USD" link="#"
                              :key="itemIdx" v-for="itemIdx in (listIdx === 1 ? [ 1 ] : [ 1, 2 ])">
                    <template #media>
                        <f7-icon f7="app_fill"></f7-icon>
                    </template>
                    <template #title>
                        <div class="display-flex padding-top-half padding-bottom-half">
                            <div class="nested-list-item-title">
                                <span>Account Name</span>
                            </div>
                        </div>
                    </template>
                </f7-list-item>
            </f7-list>
        </div>

        <f7-list strong inset dividers class="margin-vertical" v-if="!loading && noAvailableAccount">
            <f7-list-item :title="tt('No available account')"></f7-list-item>
        </f7-list>

        <div :key="accountCategory.type"
             v-for="accountCategory in AccountCategory.values(customAccountCategoryOrder)"
             v-show="!loading && ((showHidden && hasAccount(accountCategory, false)) || hasAccount(accountCategory, true))">
            <f7-list strong inset dividers sortable class="list-has-group-title account-list margin-vertical"
                     :sortable-enabled="sortable"
                     v-if="allCategorizedAccountsMap[accountCategory.type]"
                     @sortable:sort="onSort">
                <f7-list-item group-title :sortable="false">
                    <small>
                        <span>{{ tt(accountCategory.name) }} ({{ getAccountCategoryCount(accountCategory) }})</span>
                        <span style="margin-inline-start: 10px">{{ accountCategoryTotalBalance(accountCategory) }}</span>
                    </small>
                </f7-list-item>
                <f7-list-item swipeout
                              class="nested-list-item"
                              :id="getAccountDomId(account)"
                              :class="{ 'actual-first-child': account.id === firstShowingIds.accounts[accountCategory.type], 'actual-last-child': account.id === lastShowingIds.accounts[accountCategory.type] }"
                              :link="!sortable ? '/transaction/list?accountIds=' + account.id : null"
                              :key="account.id"
                              v-for="account in allCategorizedAccountsMap[accountCategory.type]!.accounts"
                              v-show="showHidden || !account.hidden"
                              @taphold="setSortable()"
                >
                    <template #media>
                        <ItemIcon icon-type="account" :icon-id="account.icon" :color="account.color">
                            <f7-badge color="gray" class="right-bottom-icon" v-if="account.hidden">
                                <f7-icon f7="eye_slash_fill"></f7-icon>
                            </f7-badge>
                        </ItemIcon>
                    </template>

                    <template #title>
                        <div class="nested-list-item-inner display-flex padding-top-half padding-bottom-half">
                            <div class="nested-list-item-title">
                                <span>{{ account.name }}</span>
                                <div class="item-footer" v-if="account.comment">{{ account.comment }}</div>
                                <div class="item-footer account-tags" v-if="getAccountTagText(account)">{{ getAccountTagText(account) }}</div>
                            </div>
                        </div>
                    </template>
                    <template #after>
                        <span class="account-balance-line">
                            <span class="account-balance">{{ accountBalance(account) }}</span>
                            <span class="account-balance-code" v-if="account.currency">({{ account.currency }})</span>
                        </span>
                        <span class="account-balance-converted" v-if="accountBalanceInDefaultCurrency(account)">
                            <span>{{ accountBalanceInDefaultCurrency(account) }}</span>
                            <span class="account-balance-code" v-if="defaultCurrency">({{ defaultCurrency }})</span>
                        </span>
                    </template>
                    <f7-swipeout-actions :left="textDirection === TextDirection.LTR"
                                         :right="textDirection === TextDirection.RTL"
                                         v-if="sortable">
                        <f7-swipeout-button :color="account.hidden ? 'blue' : 'gray'" class="padding-horizontal"
                                            overswipe close @click="hide(account, !account.hidden)">
                            <f7-icon :f7="account.hidden ? 'eye' : 'eye_slash'"></f7-icon>
                        </f7-swipeout-button>
                    </f7-swipeout-actions>
                    <f7-swipeout-actions :left="textDirection === TextDirection.RTL"
                                         :right="textDirection === TextDirection.LTR"
                                         v-if="!sortable">
                        <f7-swipeout-button color="orange" close :text="tt('Edit')" @click="edit(account)"></f7-swipeout-button>
                        <f7-swipeout-button color="primary" close :text="tt('More')" @click="showMoreActionSheetForAccount(account)"></f7-swipeout-button>
                        <f7-swipeout-button color="red" class="padding-horizontal" @click="remove(account, false)">
                            <f7-icon f7="trash"></f7-icon>
                        </f7-swipeout-button>
                    </f7-swipeout-actions>
                </f7-list-item>
            </f7-list>
        </div>

        <f7-actions close-by-outside-click close-on-escape :opened="showAccountMoreActionSheet" @actions:closed="showAccountMoreActionSheet = false">
            <f7-actions-group v-if="accountForMoreActionSheet">
                <f7-actions-button @click="showReconciliationStatement(accountForMoreActionSheet)">{{ tt('Reconciliation Statement') }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group v-if="accountForMoreActionSheet">
                <f7-actions-button @click="moveAllTransactions(accountForMoreActionSheet)">{{ tt('Move All Transactions') }}</f7-actions-button>
                <f7-actions-button color="red" @click="showPasswordSheetForClearAllTransaction(accountForMoreActionSheet)">{{ tt('Clear All Transactions') }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group>
                <f7-actions-button bold close>{{ tt('Cancel') }}</f7-actions-button>
            </f7-actions-group>
        </f7-actions>

        <f7-actions close-by-outside-click close-on-escape :opened="showMoreActionSheet" @actions:closed="showMoreActionSheet = false">
            <f7-actions-group>
                <f7-actions-button :class="{ 'disabled': maxCategoryAccountCount < 2 }" @click="setSortable()">{{ tt('Sort') }}</f7-actions-button>
                <f7-actions-button v-if="!showHidden" @click="showHidden = true">{{ tt('Show Hidden Accounts') }}</f7-actions-button>
                <f7-actions-button v-if="showHidden" @click="showHidden = false">{{ tt('Hide Hidden Accounts') }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group>
                <f7-actions-button bold close>{{ tt('Cancel') }}</f7-actions-button>
            </f7-actions-group>
        </f7-actions>

        <f7-actions close-by-outside-click close-on-escape :opened="showDeleteActionSheet" @actions:closed="showDeleteActionSheet = false">
            <f7-actions-group>
                <f7-actions-label>{{ tt('Are you sure you want to delete this account?') }}</f7-actions-label>
                <f7-actions-button color="red" @click="remove(accountToDelete, true)">{{ tt('Delete') }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group>
                <f7-actions-button bold close>{{ tt('Cancel') }}</f7-actions-button>
            </f7-actions-group>
        </f7-actions>

        <password-input-sheet :title="tt('Are you sure you want to clear all transactions?')"
                              :hint="tt('format.misc.clearTransactionsInAccountTip', { account: accountToClearTransactions?.name ?? 'undefined' })"
                              :confirm-disabled="clearingData"
                              :cancel-disabled="clearingData"
                              color="red"
                              v-model:show="showInputPasswordSheetForClearAllTransactions"
                              v-model="currentPasswordForClearData"
                              @password:confirm="clearAllTransactions">
        </password-input-sheet>
    </f7-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Router } from 'framework7/types';

import { useI18n } from '@/locales/helpers.ts';
import { useI18nUIComponents, showLoading, hideLoading } from '@/lib/ui/mobile.ts';
import { useAccountListPageBase } from '@/views/base/accounts/AccountListPageBase.ts';

import { useRootStore } from '@/stores/index.ts';
import { useAccountsStore } from '@/stores/account.ts';
import { useAccountTagsStore } from '@/stores/accountTag.ts';
import { useSettingsStore } from '@/stores/setting.ts';

import { TextDirection } from '@/core/text.ts';
import { AccountCategory } from '@/core/account.ts';
import type { Account, AccountShowingIds } from '@/models/account.ts';

import { onSwipeoutDeleted } from '@/lib/ui/mobile.ts';

const props = defineProps<{
    f7router: Router.Router;
}>();

const { tt, getCurrentLanguageTextDirection } = useI18n();
const { showAlert, showToast, routeBackOnError } = useI18nUIComponents();

const {
    loading,
    showHidden,
    displayOrderModified,
    showAccountBalance,
    customAccountCategoryOrder,
    defaultCurrency,
    allCategorizedAccountsMap,
    allAccountCount,
    maxCategoryAccountCount,
    totalAmountTargetCurrency,
    totalAmountCurrencyOptions,
    netAssetsDisplayItems,
    totalAssetsDisplayItems,
    totalLiabilitiesDisplayItems,
    getCurrencyDisplayName,
    accountCategoryTotalBalance,
    accountBalance,
    accountBalanceInDefaultCurrency
} = useAccountListPageBase();

const rootStore = useRootStore();
const accountsStore = useAccountsStore();
const settingsStore = useSettingsStore();
const accountTagsStore = useAccountTagsStore();

const loadingError = ref<unknown | null>(null);
const sortable = ref<boolean>(false);
const accountForMoreActionSheet = ref<Account | null>(null);
const accountToDelete = ref<Account | null>(null);
const accountToClearTransactions = ref<Account | null>(null);
const currentPasswordForClearData = ref<string>('');
const clearingData = ref<boolean>(false);
const showAccountMoreActionSheet = ref<boolean>(false);
const showMoreActionSheet = ref<boolean>(false);
const showDeleteActionSheet = ref<boolean>(false);
const showInputPasswordSheetForClearAllTransactions = ref<boolean>(false);
const displayOrderSaving = ref<boolean>(false);

const textDirection = computed<TextDirection>(() => getCurrentLanguageTextDirection());
const firstShowingIds = computed<AccountShowingIds>(() => accountsStore.getFirstShowingIds(showHidden.value));
const lastShowingIds = computed<AccountShowingIds>(() => accountsStore.getLastShowingIds(showHidden.value));
const noAvailableAccount = computed<boolean>(() => {
    if (showHidden.value) {
        return accountsStore.allAvailableAccountsCount < 1;
    } else {
        return accountsStore.allVisibleAccountsCount < 1;
    }
});

function hasAccount(accountCategory: AccountCategory, visibleOnly: boolean): boolean {
    return accountsStore.hasAccount(accountCategory, visibleOnly);
}

function getAccountCategoryCount(accountCategory: AccountCategory): number {
    const categorizedAccounts = allCategorizedAccountsMap.value[accountCategory.type];

    if (!categorizedAccounts || !categorizedAccounts.accounts || !categorizedAccounts.accounts.length) {
        return 0;
    }

    if (showHidden.value) {
        return categorizedAccounts.accounts.length;
    }

    let count = 0;

    for (const account of categorizedAccounts.accounts) {
        if (!account.hidden) {
            count++;
        }
    }

    return count;
}

function getAccountTagText(account: Account): string {
    if (!account) {
        return '';
    }

    const rawTags = account.tags && account.tags.length ? account.tags : (account.tag ? [account.tag] : []);
    const tagSet = new Set<string>();

    for (const rawTag of rawTags) {
        const tagName = rawTag?.trim();

        if (tagName) {
            tagSet.add(tagName);
        }
    }

    if (!tagSet.size) {
        return '';
    }

    return Array.from(tagSet).map(tag => `#${tag}`).join(' ');
}

function getAccountDomId(account: Account): string {
    return 'account_' + account.id;
}

function parseAccountIdFromDomId(domId: string): string | null {
    if (!domId || domId.indexOf('account_') !== 0) {
        return null;
    }

    return domId.substring(8); // account_
}

function init(): void {
    loading.value = true;

    accountTagsStore.loadAllTags({
        force: false
    }).catch(() => {
        // ignore tag loading errors for account list totals
    });

    accountsStore.loadAllAccounts({
        force: false
    }).then(() => {
        loading.value = false;
    }).catch(error => {
        if (error.processed) {
            loading.value = false;
        } else {
            loadingError.value = error;
            showToast(error.message || error);
        }
    });
}

function reload(done?: () => void): void {
    if (sortable.value) {
        done?.();
        return;
    }

    const force = !!done;

    accountTagsStore.loadAllTags({
        force: force
    }).catch(() => {
        // ignore tag loading errors for account list totals
    });

    accountsStore.loadAllAccounts({
        force: force
    }).then(() => {
        done?.();

        if (force) {
            showToast('Account list has been updated');
        }
    }).catch(error => {
        done?.();

        if (!error.processed) {
            showToast(error.message || error);
        }
    });
}

function edit(account: Account): void {
    props.f7router.navigate('/account/edit?id=' + account.id);
}

function showMoreActionSheetForAccount(account: Account): void {
    accountForMoreActionSheet.value = account;
    showAccountMoreActionSheet.value = true;
}

function showReconciliationStatement(account: Account | null): void {
    if (!account) {
        showAlert('An error occurred');
        return;
    }

    props.f7router.navigate('/account/reconciliation_statements?accountId=' + account.id);
    showAccountMoreActionSheet.value = false;
    accountForMoreActionSheet.value = null;
}

function moveAllTransactions(account: Account | null): void {
    if (!account) {
        showAlert('An error occurred');
        return;
    }

    props.f7router.navigate('/account/move_all_transactions?fromAccountId=' + account.id);
    showAccountMoreActionSheet.value = false;
    accountForMoreActionSheet.value = null;
}

function showPasswordSheetForClearAllTransaction(account: Account | null): void {
    if (!account) {
        showAlert('An error occurred');
        return;
    }

    accountToClearTransactions.value = account;
    currentPasswordForClearData.value = '';
    showInputPasswordSheetForClearAllTransactions.value = true;
    showAccountMoreActionSheet.value = false;
    accountForMoreActionSheet.value = null;
}

function clearAllTransactions(password: string): void {
    if (!accountToClearTransactions.value) {
        showAlert('An error occurred');
        return;
    }

    clearingData.value = true;
    showLoading(() => clearingData.value);

    rootStore.clearAllUserTransactionsOfAccount({
        accountId: accountToClearTransactions.value.id,
        password: password
    }).then(() => {
        clearingData.value = false;
        currentPasswordForClearData.value = '';
        hideLoading();

        showInputPasswordSheetForClearAllTransactions.value = false;
        showToast('All transactions in this account have been cleared');
    }).catch(error => {
        clearingData.value = false;
        hideLoading();

        if (!error.processed) {
            showToast(error.message || error);
        }
    });
}

function hide(account: Account, hidden: boolean): void {
    showLoading();

    accountsStore.hideAccount({
        account: account,
        hidden: hidden
    }).then(() => {
        hideLoading();
    }).catch(error => {
        hideLoading();

        if (!error.processed) {
            showToast(error.message || error);
        }
    });
}

function remove(account: Account | null, confirm: boolean): void {
    if (!account) {
        showAlert('An error occurred');
        return;
    }

    if (!confirm) {
        accountToDelete.value = account;
        showDeleteActionSheet.value = true;
        return;
    }

    showDeleteActionSheet.value = false;
    accountToDelete.value = null;
    showLoading();

    accountsStore.deleteAccount({
        account: account,
        beforeResolve: (done) => {
            onSwipeoutDeleted(getAccountDomId(account), done);
        }
    }).then(() => {
        hideLoading();
    }).catch(error => {
        hideLoading();

        if (!error.processed) {
            showToast(error.message || error);
        }
    });
}

function setSortable(): void {
    if (sortable.value) {
        return;
    }

    showHidden.value = true;
    sortable.value = true;
    displayOrderModified.value = false;
}

function saveSortResult(): void {
    if (!displayOrderModified.value) {
        showHidden.value = false;
        sortable.value = false;
        return;
    }

    displayOrderSaving.value = true;
    showLoading();

    accountsStore.updateAccountDisplayOrders().then(() => {
        displayOrderSaving.value = false;
        hideLoading();

        showHidden.value = false;
        sortable.value = false;
        displayOrderModified.value = false;
    }).catch(error => {
        displayOrderSaving.value = false;
        hideLoading();

        if (!error.processed) {
            showToast(error.message || error);
        }
    });
}

function cancelSort(): void {
    if (!displayOrderModified.value) {
        showHidden.value = false;
        sortable.value = false;
        return;
    }

    displayOrderSaving.value = true;
    showLoading();

    accountsStore.loadAllAccounts({
        force: false
    }).then(() => {
        displayOrderSaving.value = false;
        hideLoading();

        showHidden.value = false;
        sortable.value = false;
        displayOrderModified.value = false;
    }).catch(error => {
        displayOrderSaving.value = false;
        hideLoading();

        if (!error.processed) {
            showToast(error.message || error);
        }
    });
}

function setAccountsIncludedInTotal(): void {
    props.f7router.navigate('/settings/filter/account?type=accountListTotalAmount');
}

function setAccountTagsIncludedInTotal(): void {
    props.f7router.navigate('/settings/filter/account_tag?type=accountListTotalAmount');
}

function setTotalAmountTargetCurrency(currency: string): void {
    settingsStore.setTotalAmountTargetCurrency(currency);
}

function onSort(event: { el: { id: string }; from: number; to: number }): void {
    if (!event || !event.el || !event.el.id) {
        showToast('Unable to move account');
        return;
    }

    const id = parseAccountIdFromDomId(event.el.id);

    if (!id) {
        showToast('Unable to move account');
        return;
    }

    accountsStore.changeAccountDisplayOrder({
        accountId: id,
        from: event.from - 1, // first item in the list is title, so the index need minus one
        to: event.to - 1,
        updateListOrder: true,
        updateGlobalListOrder: true
    }).then(() => {
        displayOrderModified.value = true;
    }).catch(error => {
        showToast(error.message || error);
    });
}

function onPageAfterIn(): void {
    if (accountsStore.accountListStateInvalid && !loading.value) {
        reload();
    }

    routeBackOnError(props.f7router, loadingError);
}

init();
</script>

<style>
.account-overview-card {
    background-color: var(--f7-color-yellow);
}

.dark .account-overview-card {
    background-color: var(--f7-theme-color);
}

.dark .account-overview-card a {
    color: var(--f7-text-color);
    opacity: 0.6;
}

.net-assets {
    font-size: 1.5em;
}

.net-assets-line {
    display: flex;
    align-items: baseline;
    gap: 6px;
}

.net-assets-currency {
    font-size: 0.75em;
    opacity: 0.7;
}

.account-overview-info {
    opacity: 0.6;
}

.account-overview-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
}

.account-overview-section-label {
    font-size: 0.9em;
}

.account-overview-section-values {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.account-overview-value {
    display: flex;
    align-items: baseline;
    gap: 6px;
}

.account-overview-currency {
    font-size: 0.8em;
    opacity: 0.7;
}

.account-overview-info > span {
    margin-inline-end: 4px;
}

.account-overview-info > span:last-child {
    margin-inline-end: 0;
}

.account-total-currency-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
}

.account-total-currency-chips .chip-selected {
    --f7-chip-outline-border-color: var(--f7-theme-color);
    --f7-chip-text-color: var(--f7-theme-color);
}

.account-total-filter-link {
    margin-top: 6px;
}

.account-list {
    --f7-list-item-footer-font-size: var(--ebk-large-footer-font-size);
}

.account-list .item-footer {
    padding-top: 4px;
}

.account-list .account-tags {
    opacity: 0.7;
    font-size: 0.8em;
}

.account-list .item-after {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
}

.account-list .account-balance-line {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
}

.account-list .account-balance-code {
    font-size: 0.8em;
    opacity: 0.7;
}

.account-list .account-balance-converted {
    font-size: 0.8em;
    opacity: 0.7;
}
</style>
