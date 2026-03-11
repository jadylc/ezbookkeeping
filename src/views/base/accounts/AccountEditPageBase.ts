import { ref, computed, watch } from 'vue';

import { useI18n } from '@/locales/helpers.ts';

import { useSettingsStore } from '@/stores/setting.ts';
import { useUserStore } from '@/stores/user.ts';

import { AccountCategory, AccountType } from '@/core/account.ts';
import type { LocalizedAccountCategory } from '@/core/account.ts';
import { Account } from '@/models/account.ts';

import { isDefined } from '@/lib/common.ts';
import {
    getTimezoneOffsetMinutes,
    getSameDateTimeWithCurrentTimezone,
    parseDateTimeFromUnixTimeWithBrowserTimezone,
    getCurrentUnixTime
} from '@/lib/datetime.ts';

export interface DayAndDisplayName {
    readonly day: number;
    readonly displayName: string;
}

export function useAccountEditPageBase() {
    const { tt, getAllAccountCategories, getMonthdayShortName } = useI18n();

    const settingsStore = useSettingsStore();
    const userStore = useUserStore();

    const defaultAccountCategory = AccountCategory.values(settingsStore.appSettings.accountCategoryOrders)[0] ?? AccountCategory.Default;

    const editAccountId = ref<string | null>(null);
    const clientSessionId = ref<string>('');
    const loading = ref<boolean>(false);
    const submitting = ref<boolean>(false);
    const account = ref<Account>(Account.createNewAccount(defaultAccountCategory, userStore.currentUserDefaultCurrency, getCurrentUnixTimeForNewAccount()));

    const title = computed<string>(() => {
        if (!editAccountId.value) {
            return 'Add Account';
        } else {
            return 'Edit Account';
        }
    });

    const saveButtonTitle = computed<string>(() => {
        if (!editAccountId.value) {
            return 'Add';
        } else {
            return 'Save';
        }
    });

    const inputEmptyProblemMessage = computed<string | null>(() => getInputEmptyProblemMessage(account.value));

    const inputIsEmpty = computed<boolean>(() => !!inputEmptyProblemMessage.value);

    const customAccountCategoryOrder = computed<string>(() => settingsStore.appSettings.accountCategoryOrders);
    const allAccountCategories = computed<LocalizedAccountCategory[]>(() => getAllAccountCategories(customAccountCategoryOrder.value));
    const allAvailableMonthDays = computed<DayAndDisplayName[]>(() => {
        const allAvailableDays: DayAndDisplayName[] = [];

        allAvailableDays.push({
            day: 0,
            displayName: tt('Not set'),
        });

        for (let i = 1; i <= 28; i++) {
            allAvailableDays.push({
                day: i,
                displayName: getMonthdayShortName(i),
            });
        }

        return allAvailableDays;
    });

    const isAccountSupportCreditCardStatementDate = computed<boolean>(() => account.value && account.value.category === AccountCategory.CreditCard.type);

    function getCurrentUnixTimeForNewAccount(): number {
        return getSameDateTimeWithCurrentTimezone(parseDateTimeFromUnixTimeWithBrowserTimezone(getCurrentUnixTime())).getUnixTime();
    }

    function getDefaultTimezoneOffsetMinutes(account: Account): number {
        if (!account.balanceTime) {
            return 0;
        }

        return getTimezoneOffsetMinutes(account.balanceTime);
    }

    function getAccountCreditCardStatementDate(statementDate?: number): string | null {
        for (const item of allAvailableMonthDays.value) {
            if (item.day === statementDate) {
                return item.displayName;
            }
        }

        return null;
    }

    function updateAccountBalanceTime(account: Account, balanceTime: number): void {
        if (!isDefined(account.balanceTime)) {
            account.balanceTime = balanceTime;
            return;
        }

        const oldUtcOffset = getTimezoneOffsetMinutes(account.balanceTime);
        const newUtcOffset = getTimezoneOffsetMinutes(balanceTime);

        if (oldUtcOffset === newUtcOffset) {
            account.balanceTime = balanceTime;
            return;
        }

        account.balanceTime = balanceTime - (newUtcOffset - oldUtcOffset) * 60;
    }

    function getInputEmptyProblemMessage(account: Account): string | null {
        if (!account.category) {
            return 'Account category cannot be blank';
        } else if (!account.name) {
            return 'Account name cannot be blank';
        } else if (account.type === AccountType.SingleAccount.type && !account.currency) {
            return 'Account currency cannot be blank';
        } else {
            return null;
        }
    }

    function isNewAccount(account: Account): boolean {
        return account.id === '' || account.id === '0';
    }

    function setAccount(newAccount: Account): void {
        account.value.fillFrom(newAccount);
    }

    watch(() => account.value.category, (newValue, oldValue) => {
        account.value.setSuitableIcon(oldValue, newValue);
    });

    return {
        // constants
        defaultAccountCategory,
        // states
        editAccountId,
        clientSessionId,
        loading,
        submitting,
        account,
        // computed states
        title,
        saveButtonTitle,
        inputEmptyProblemMessage,
        inputIsEmpty,
        allAccountCategories,
        allAvailableMonthDays,
        isAccountSupportCreditCardStatementDate,
        // functions
        getCurrentUnixTimeForNewAccount,
        getDefaultTimezoneOffsetMinutes,
        getAccountCreditCardStatementDate,
        updateAccountBalanceTime,
        isNewAccount,
        setAccount
    };
}
