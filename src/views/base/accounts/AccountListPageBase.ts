import { ref, computed } from 'vue';

import { useI18n } from '@/locales/helpers.ts';

import { useSettingsStore } from '@/stores/setting.ts';
import { useUserStore } from '@/stores/user.ts';
import { useAccountsStore } from '@/stores/account.ts';
import { useExchangeRatesStore } from '@/stores/exchangeRates.ts';

import type { HiddenAmount, NumberWithSuffix } from '@/core/numeral.ts';
import type { WeekDayValue } from '@/core/datetime.ts';
import { AccountCategory } from '@/core/account.ts';
import { CurrencyDisplayType } from '@/core/currency.ts';
import type { Account, CategorizedAccount } from '@/models/account.ts';

import { isNumber, isString } from '@/lib/common.ts';

export function useAccountListPageBase() {
    const { tt, formatAmountToLocalizedNumeralsWithCurrency, getCurrencyName } = useI18n();

    const settingsStore = useSettingsStore();
    const userStore = useUserStore();
    const accountsStore = useAccountsStore();
    const exchangeRatesStore = useExchangeRatesStore();

    const loading = ref<boolean>(true);
    const showHidden = ref<boolean>(false);
    const displayOrderModified = ref<boolean>(false);

    const showAccountBalance = computed<boolean>({
        get: () => settingsStore.appSettings.showAccountBalance,
        set: (value) => settingsStore.setShowAccountBalance(value)
    });

    const customAccountCategoryOrder = computed<string>(() => settingsStore.appSettings.accountCategoryOrders);
    const defaultAccountCategory = computed<AccountCategory>(() => AccountCategory.values(customAccountCategoryOrder.value)[0] ?? AccountCategory.Default);

    const firstDayOfWeek = computed<WeekDayValue>(() => userStore.currentUserFirstDayOfWeek);
    const fiscalYearStart = computed<number>(() => userStore.currentUserFiscalYearStart);
    const defaultCurrency = computed<string>(() => userStore.currentUserDefaultCurrency);
    const totalAmountTargetCurrency = computed<string>(() => settingsStore.appSettings.totalAmountTargetCurrency || '');
    const totalAmountTargetCurrencyForCalc = computed<string>(() => accountsStore.getTotalAmountTargetCurrency());
    const totalAmountCurrencyOptions = computed<string[]>(() => {
        const currencySet = new Set<string>();

        currencySet.add('');
        currencySet.add(defaultCurrency.value);

        for (const account of allAccounts.value) {
            if (account.currency) {
                currencySet.add(account.currency);
            }
        }

        const options: string[] = [];
        const defaultCurrencyCode = defaultCurrency.value;

        if (currencySet.has('')) {
            options.push('');
        }

        if (defaultCurrencyCode && currencySet.has(defaultCurrencyCode)) {
            options.push(defaultCurrencyCode);
            currencySet.delete(defaultCurrencyCode);
        }

        for (const currency of Array.from(currencySet).filter(currency => currency).sort()) {
            options.push(currency);
        }

        return options;
    });

    const allAccounts = computed<Account[]>(() => accountsStore.allAccounts);
    const allCategorizedAccountsMap = computed<Record<number, CategorizedAccount>>(() => accountsStore.allCategorizedAccountsMap);
    const allAccountCount = computed<number>(() => accountsStore.allAvailableAccountsCount);
    const maxCategoryAccountCount = computed<number>(() => accountsStore.maxCategoryAccountCount);

    const netAssets = computed<string>(() => {
        const netAssets: number | HiddenAmount | NumberWithSuffix = accountsStore.getNetAssets(showAccountBalance.value);
        return formatAmountToLocalizedNumeralsWithCurrency(netAssets, totalAmountTargetCurrencyForCalc.value);
    });

    const totalAssets = computed<string>(() => {
        const totalAssets: number | HiddenAmount | NumberWithSuffix = accountsStore.getTotalAssets(showAccountBalance.value);
        return formatAmountToLocalizedNumeralsWithCurrency(totalAssets, totalAmountTargetCurrencyForCalc.value);
    });

    const totalLiabilities = computed<string>(() => {
        const totalLiabilities: number | HiddenAmount | NumberWithSuffix = accountsStore.getTotalLiabilities(showAccountBalance.value);
        return formatAmountToLocalizedNumeralsWithCurrency(totalLiabilities, totalAmountTargetCurrencyForCalc.value);
    });

    const isTotalAmountMultiCurrency = computed<boolean>(() => !totalAmountTargetCurrency.value);

    function getCurrencyDisplayName(currency: string): string {
        if (!currency) {
            return tt('All Currencies');
        }

        const currencyName = getCurrencyName(currency);

        if (!currencyName || currencyName === currency) {
            return currency;
        }

        return `${currencyName} (${currency})`;
    }

    function formatTotalAmount(value: number | HiddenAmount | NumberWithSuffix, currency: string): string {
        return formatAmountToLocalizedNumeralsWithCurrency(value, currency, CurrencyDisplayType.None);
    }

    function buildCurrencyDisplayItems(currencyMap: Record<string, number | HiddenAmount | NumberWithSuffix>, fallbackValue?: number | HiddenAmount | NumberWithSuffix): { currency: string, amount: string, currencyName: string }[] {
        const currencies = Object.keys(currencyMap || {}).filter(currency => currency);
        const displayItems: { currency: string, amount: string, currencyName: string }[] = [];

        if (currencies.length < 1) {
            const fallbackCurrency = defaultCurrency.value || totalAmountTargetCurrencyForCalc.value;

            if (!fallbackCurrency) {
                return displayItems;
            }

            const amountValue = fallbackValue ?? 0;
            displayItems.push({
                currency: fallbackCurrency,
                amount: formatTotalAmount(amountValue, fallbackCurrency),
                currencyName: getCurrencyDisplayName(fallbackCurrency)
            });

            return displayItems;
        }

        const defaultCurrencyCode = defaultCurrency.value;
        currencies.sort((a, b) => a.localeCompare(b));

        if (defaultCurrencyCode && currencies.includes(defaultCurrencyCode)) {
            currencies.splice(currencies.indexOf(defaultCurrencyCode), 1);
            currencies.unshift(defaultCurrencyCode);
        }

        for (const currency of currencies) {
            displayItems.push({
                currency: currency,
                amount: formatTotalAmount(currencyMap[currency] as number | HiddenAmount | NumberWithSuffix, currency),
                currencyName: getCurrencyDisplayName(currency)
            });
        }

        return displayItems;
    }

    const netAssetsDisplayItems = computed(() => {
        if (isTotalAmountMultiCurrency.value) {
            return buildCurrencyDisplayItems(accountsStore.getNetAssetsByCurrency(showAccountBalance.value));
        }

        const netAssetsValue = accountsStore.getNetAssets(showAccountBalance.value);
        const currency = totalAmountTargetCurrencyForCalc.value;
        return buildCurrencyDisplayItems({ [currency]: netAssetsValue }, netAssetsValue);
    });

    const totalAssetsDisplayItems = computed(() => {
        if (isTotalAmountMultiCurrency.value) {
            return buildCurrencyDisplayItems(accountsStore.getTotalAssetsByCurrency(showAccountBalance.value));
        }

        const totalAssetsValue = accountsStore.getTotalAssets(showAccountBalance.value);
        const currency = totalAmountTargetCurrencyForCalc.value;
        return buildCurrencyDisplayItems({ [currency]: totalAssetsValue }, totalAssetsValue);
    });

    const totalLiabilitiesDisplayItems = computed(() => {
        if (isTotalAmountMultiCurrency.value) {
            return buildCurrencyDisplayItems(accountsStore.getTotalLiabilitiesByCurrency(showAccountBalance.value));
        }

        const totalLiabilitiesValue = accountsStore.getTotalLiabilities(showAccountBalance.value);
        const currency = totalAmountTargetCurrencyForCalc.value;
        return buildCurrencyDisplayItems({ [currency]: totalLiabilitiesValue }, totalLiabilitiesValue);
    });

    function accountCategoryTotalBalance(accountCategory?: AccountCategory): string {
        if (!accountCategory) {
            return '';
        }

        const totalBalance: number | HiddenAmount | NumberWithSuffix = accountsStore.getAccountCategoryTotalBalance(showAccountBalance.value, accountCategory);
        return formatAmountToLocalizedNumeralsWithCurrency(totalBalance, totalAmountTargetCurrencyForCalc.value);
    }

    function accountBalance(account: Account): string | null {
        const balance: number | HiddenAmount | null = accountsStore.getAccountBalance(showAccountBalance.value, account);

        if (!isNumber(balance) && !isString(balance)) {
            return '';
        }

        return formatAmountToLocalizedNumeralsWithCurrency(balance, account.currency);
    }

    function accountBalanceInDefaultCurrency(account: Account): string {
        const balance: number | HiddenAmount | null = accountsStore.getAccountBalance(showAccountBalance.value, account);
        const targetCurrency = defaultCurrency.value;

        if (!isNumber(balance) || !targetCurrency || !account.currency || account.currency === targetCurrency) {
            return '';
        }

        const exchangedBalance = exchangeRatesStore.getExchangedAmount(balance, account.currency, targetCurrency);

        if (!isNumber(exchangedBalance)) {
            return '';
        }

        return formatAmountToLocalizedNumeralsWithCurrency(Math.trunc(exchangedBalance), targetCurrency);
    }

    return {
        // states
        loading,
        showHidden,
        displayOrderModified,
        // computed states
        showAccountBalance,
        customAccountCategoryOrder,
        defaultAccountCategory,
        firstDayOfWeek,
        fiscalYearStart,
        defaultCurrency,
        totalAmountTargetCurrency,
        totalAmountTargetCurrencyForCalc,
        totalAmountCurrencyOptions,
        allAccounts,
        allCategorizedAccountsMap,
        allAccountCount,
        maxCategoryAccountCount,
        isTotalAmountMultiCurrency,
        netAssets,
        netAssetsDisplayItems,
        totalAssets,
        totalAssetsDisplayItems,
        totalLiabilities,
        totalLiabilitiesDisplayItems,
        // functions
        getCurrencyDisplayName,
        accountCategoryTotalBalance,
        accountBalance,
        accountBalanceInDefaultCurrency
    };
}
