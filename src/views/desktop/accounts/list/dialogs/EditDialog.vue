<template>
    <v-dialog :width="800" :persistent="isAccountModified" v-model="showState">
        <v-card class="pa-sm-1 pa-md-2">
            <template #title>
                <div class="d-flex align-center justify-center">
                    <div class="d-flex align-center">
                        <h4 class="text-h4">{{ tt(title) }}</h4>
                        <v-progress-circular indeterminate size="22" class="ms-2" v-if="loading"></v-progress-circular>
                    </div>
                    <v-spacer/>
                </div>
            </template>
            <v-card-text>
                <v-form class="mt-2">
                    <v-row>
                        <v-col cols="12" md="12">
                            <v-select
                                item-title="displayName"
                                item-value="type"
                                persistent-placeholder
                                :disabled="loading || submitting"
                                :label="tt('Account Category')"
                                :placeholder="tt('Account Category')"
                                :items="allAccountCategories"
                                :no-data-text="tt('No results')"
                                v-model="account.category"
                            >
                                <template #item="{ props, item }">
                                    <v-list-item :value="item.value" v-bind="props">
                                        <template #title>
                                            <v-list-item-title>
                                                <div class="d-flex align-center">
                                                    <ItemIcon icon-type="account"
                                                              :icon-id="item.raw.defaultAccountIconId"
                                                              v-if="item.raw" />
                                                    <span class="ms-2">{{ item.title }}</span>
                                                </div>
                                            </v-list-item-title>
                                        </template>
                                    </v-list-item>
                                </template>
                            </v-select>
                        </v-col>
                        <v-col cols="12" md="12">
                            <v-text-field
                                type="text"
                                persistent-placeholder
                                :disabled="loading || submitting"
                                :label="tt('Account Name')"
                                :placeholder="tt('Your account name')"
                                v-model="account.name"
                            />
                        </v-col>
                        <v-col cols="12" md="12">
                            <v-autocomplete
                                item-title="name"
                                item-value="name"
                                persistent-placeholder
                                multiple
                                chips
                                closable-chips
                                :disabled="loading || submitting"
                                :label="tt('Account Tag')"
                                :placeholder="tt('Your account tag (optional)')"
                                :items="allAccountTags"
                                :custom-filter="filterAccountTag"
                                :no-data-text="tt('No available tag')"
                                v-model="account.tags"
                            >
                                <template #item="{ props, item }">
                                    <v-list-item :value="item.value"
                                                 v-bind="props"
                                                 :disabled="item.raw.hidden && !account.tags.includes(item.value)"
                                                 v-if="!item.raw.hidden || account.tags.includes(item.value)">
                                        <template #title>
                                            <v-list-item-title>
                                                <div class="d-flex align-center">
                                                    <v-icon size="20" start :icon="mdiPound"/>
                                                    <span>{{ item.title }}</span>
                                                </div>
                                            </v-list-item-title>
                                        </template>
                                    </v-list-item>
                                </template>
                            </v-autocomplete>
                        </v-col>
                        <v-col cols="12" md="6">
                            <icon-select icon-type="account"
                                         :all-icon-infos="ALL_ACCOUNT_ICONS"
                                         :label="tt('Account Icon')"
                                         :color="account.color"
                                         :disabled="loading || submitting"
                                         v-model="account.icon" />
                        </v-col>
                        <v-col cols="12" md="6">
                            <color-select :all-color-infos="ALL_ACCOUNT_COLORS"
                                          :label="tt('Account Color')"
                                          :disabled="loading || submitting"
                                          v-model="account.color" />
                        </v-col>
                        <v-col cols="12" :md="isAccountSupportCreditCardStatementDate ? 6 : 12">
                            <currency-select :disabled="loading || submitting"
                                             :label="tt('Currency')"
                                             :placeholder="tt('Currency')"
                                             v-model="account.currency" />
                        </v-col>
                        <v-col cols="12" md="6" v-if="isAccountSupportCreditCardStatementDate">
                            <v-autocomplete
                                item-title="displayName"
                                item-value="day"
                                auto-select-first
                                persistent-placeholder
                                :disabled="loading || submitting"
                                :label="tt('Statement Date')"
                                :placeholder="tt('Statement Date')"
                                :items="allAvailableMonthDays"
                                :no-data-text="tt('No results')"
                                v-model="account.creditCardStatementDate"
                            ></v-autocomplete>
                        </v-col>
                        <v-col cols="12" :md="(!editAccountId || isNewAccount(account)) && account.balance ? 6 : 12">
                            <amount-input :disabled="loading || submitting"
                                          :persistent-placeholder="true"
                                          :currency="account.currency"
                                          :show-currency="true"
                                          :flip-negative="account.isLiability"
                                          :label="accountAmountTitle"
                                          :placeholder="accountAmountTitle"
                                          v-model="account.balance"/>
                        </v-col>
                        <v-col cols="12" md="6" v-show="account.balance"
                               v-if="!editAccountId || isNewAccount(account)">
                            <date-time-select
                                :disabled="loading || submitting"
                                :label="tt('Balance Time')"
                                :timezone-utc-offset="getDefaultTimezoneOffsetMinutes(account)"
                                :model-value="account.balanceTime"
                                @update:model-value="updateAccountBalanceTime(account, $event)"
                                @error="onShowDateTimeError" />
                        </v-col>
                        <v-col cols="12" md="12">
                            <v-textarea
                                type="text"
                                persistent-placeholder
                                rows="3"
                                :disabled="loading || submitting"
                                :label="tt('Description')"
                                :placeholder="tt('Your account description (optional)')"
                                v-model="account.comment"
                            />
                        </v-col>
                        <v-col class="py-0" cols="12" md="12" v-if="editAccountId && !isNewAccount(account)">
                            <v-switch :disabled="loading || submitting"
                                      :label="tt('Visible')" v-model="account.visible"/>
                        </v-col>
                    </v-row>
                </v-form>
            </v-card-text>
            <v-card-text>
                <div class="w-100 d-flex justify-center flex-wrap mt-sm-1 mt-md-2 gap-4">
                    <v-tooltip :disabled="!inputIsEmpty" :text="inputEmptyProblemMessage ? tt(inputEmptyProblemMessage) : ''">
                        <template v-slot:activator="{ props }">
                            <div v-bind="props" class="d-inline-block">
                                <v-btn :disabled="inputIsEmpty || loading || submitting" @click="save">
                                    {{ tt(saveButtonTitle) }}
                                    <v-progress-circular indeterminate size="22" class="ms-2" v-if="submitting"></v-progress-circular>
                                </v-btn>
                            </div>
                        </template>
                    </v-tooltip>
                    <v-btn color="secondary" variant="tonal"
                           :disabled="loading || submitting" @click="cancel">{{ tt('Cancel') }}</v-btn>
                </div>
            </v-card-text>
        </v-card>
    </v-dialog>

    <confirm-dialog ref="confirmDialog"/>
    <snack-bar ref="snackbar" />
</template>

<script setup lang="ts">
import ConfirmDialog from '@/components/desktop/ConfirmDialog.vue';
import SnackBar from '@/components/desktop/SnackBar.vue';

import { ref, computed, useTemplateRef } from 'vue';

import { useI18n } from '@/locales/helpers.ts';
import { useAccountEditPageBase } from '@/views/base/accounts/AccountEditPageBase.ts';

import { useUserStore } from '@/stores/user.ts';
import { useAccountsStore } from '@/stores/account.ts';
import { useAccountTagsStore } from '@/stores/accountTag.ts';

import { ALL_ACCOUNT_ICONS } from '@/consts/icon.ts';
import { ALL_ACCOUNT_COLORS } from '@/consts/color.ts';
import { Account } from '@/models/account.ts';
import type { AccountTag } from '@/models/account_tag.ts';

import { isNumber } from '@/lib/common.ts';
import { matchSearchText } from '@/lib/search.ts';
import { generateRandomUUID } from '@/lib/misc.ts';

import {
    mdiPound
} from '@mdi/js';


interface AccountEditResponse {
    message: string;
}

type ConfirmDialogType = InstanceType<typeof ConfirmDialog>;
type SnackBarType = InstanceType<typeof SnackBar>;

const { tt } = useI18n();
const {
    defaultAccountCategory,
    editAccountId,
    clientSessionId,
    loading,
    submitting,
    account,
    title,
    saveButtonTitle,
    inputEmptyProblemMessage,
    inputIsEmpty,
    allAccountCategories,
    allAvailableMonthDays,
    isAccountSupportCreditCardStatementDate,
    getCurrentUnixTimeForNewAccount,
    getDefaultTimezoneOffsetMinutes,
    updateAccountBalanceTime,
    isNewAccount,
    setAccount
} = useAccountEditPageBase();

const userStore = useUserStore();
const accountsStore = useAccountsStore();
const accountTagsStore = useAccountTagsStore();

const confirmDialog = useTemplateRef<ConfirmDialogType>('confirmDialog');
const snackbar = useTemplateRef<SnackBarType>('snackbar');

const showState = ref<boolean>(false);
const accountAmountTitle = computed<string>(() => account.value.isLiability ? tt('Account Outstanding Balance') : tt('Account Balance'));
const allAccountTags = computed(() => accountTagsStore.allAccountTags);

const isAccountModified = computed<boolean>(() => {
    if (!editAccountId.value) {
        return !account.value.equals(Account.createNewAccount(defaultAccountCategory, userStore.currentUserDefaultCurrency, account.value.balanceTime ?? getCurrentUnixTimeForNewAccount()));
    } else {
        return true;
    }
});

let resolveFunc: ((value: AccountEditResponse) => void) | null = null;
let rejectFunc: ((reason?: unknown) => void) | null = null;

function open(options?: { id?: string, currentAccount?: Account, category?: number }): Promise<AccountEditResponse> {
    showState.value = true;
    loading.value = true;
    submitting.value = false;

    accountTagsStore.loadAllTags({
        force: false
    }).catch(error => {
        if (!error.processed) {
            snackbar.value?.showError(error);
        }
    });

    const newAccount = Account.createNewAccount(defaultAccountCategory, userStore.currentUserDefaultCurrency, getCurrentUnixTimeForNewAccount());
    account.value.fillFrom(newAccount);
    clientSessionId.value = generateRandomUUID();

    if (options && options.id) {
        if (options.currentAccount) {
            setAccount(options.currentAccount);
        }

        editAccountId.value = options.id;
        accountsStore.getAccount({
            accountId: editAccountId.value
        }).then(response => {
            setAccount(response);
            loading.value = false;
        }).catch(error => {
            loading.value = false;
            showState.value = false;

            if (!error.processed) {
                if (rejectFunc) {
                    rejectFunc(error);
                }
            }
        });
    } else {
        if (options && isNumber(options.category)) {
            account.value.category = options.category;
            account.value.setSuitableIcon(1, options.category);
        }

        editAccountId.value = null;
        loading.value = false;
    }

    return new Promise<AccountEditResponse>((resolve, reject) => {
        resolveFunc = resolve;
        rejectFunc = reject;
    });
}

function save(): void {
    const problemMessage = inputEmptyProblemMessage.value;

    if (problemMessage) {
        snackbar.value?.showMessage(problemMessage);
        return;
    }

    submitting.value = true;

    accountsStore.saveAccount({
        account: account.value,
        isEdit: !!editAccountId.value,
        clientSessionId: clientSessionId.value
    }).then(() => {
        submitting.value = false;

        let message = 'You have saved this account';

        if (!editAccountId.value) {
            message = 'You have added a new account';
        }

        resolveFunc?.({ message });
        showState.value = false;
    }).catch(error => {
        submitting.value = false;

        if (!error.processed) {
            snackbar.value?.showError(error);
        }
    });
}

function cancel(): void {
    rejectFunc?.();
    showState.value = false;
}

function onShowDateTimeError(error: string): void {
    snackbar.value?.showError(error);
}

function filterAccountTag(value: string, query: string, item?: { value: unknown, raw: AccountTag }): boolean {
    if (!item) {
        return false;
    }

    if (!query) {
        return true;
    }

    return matchSearchText(item.raw.name, query);
}

defineExpose({
    open
});
</script>
