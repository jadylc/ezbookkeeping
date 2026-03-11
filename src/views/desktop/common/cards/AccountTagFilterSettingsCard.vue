<template>
    <v-card :class="{ 'pa-sm-1 pa-md-2': dialogMode }">
        <template #title>
            <v-row>
                <v-col cols="6">
                    <div :class="{ 'text-h4': dialogMode, 'text-wrap': true }">
                        {{ tt(title) }}
                    </div>
                </v-col>
                <v-col cols="6" class="d-flex align-center">
                    <v-spacer v-if="!dialogMode"/>
                    <v-text-field density="compact" :disabled="loading || !hasAnyAvailableTag"
                                  :prepend-inner-icon="mdiMagnify"
                                  :placeholder="tt('Find tag')"
                                  v-model="filterContent"
                                  v-if="dialogMode"></v-text-field>
                    <v-btn density="comfortable" color="default" variant="text" class="ms-2"
                           :disabled="loading || !hasAnyAvailableTag" :icon="true">
                        <v-icon :icon="mdiDotsVertical" />
                        <v-menu activator="parent">
                            <v-list>
                                <v-list-item :prepend-icon="mdiSelectAll"
                                             :title="tt('Select All')"
                                             :disabled="!hasAnyVisibleTag"
                                             @click="selectAllTags"></v-list-item>
                                <v-list-item :prepend-icon="mdiSelect"
                                             :title="tt('Select None')"
                                             :disabled="!hasAnyVisibleTag"
                                             @click="selectNoneTags"></v-list-item>
                                <v-list-item :prepend-icon="mdiSelectInverse"
                                             :title="tt('Invert Selection')"
                                             :disabled="!hasAnyVisibleTag"
                                             @click="selectInvertTags"></v-list-item>
                                <v-divider class="my-2"/>
                                <v-list-item :prepend-icon="mdiEyeOutline"
                                             :title="tt('Show Hidden Account Tags')"
                                             v-if="!showHidden" @click="showHidden = true"></v-list-item>
                                <v-list-item :prepend-icon="mdiEyeOffOutline"
                                             :title="tt('Hide Hidden Account Tags')"
                                             v-if="showHidden" @click="showHidden = false"></v-list-item>
                            </v-list>
                        </v-menu>
                    </v-btn>
                </v-col>
            </v-row>
        </template>

        <div v-if="loading">
            <v-skeleton-loader type="paragraph" :loading="loading"
                               :key="itemIdx" v-for="itemIdx in [ 1, 2, 3 ]"></v-skeleton-loader>
        </div>

        <v-card-text v-if="!loading && !hasAnyVisibleTag">
            <span class="text-body-1">{{ tt('No available tag') }}</span>
        </v-card-text>

        <v-card-text :class="{ 'flex-grow-1 overflow-y-auto': dialogMode }" v-else-if="!loading && hasAnyVisibleTag">
            <v-list rounded density="comfortable" class="pa-0">
                <template :key="accountTag.id" v-for="(accountTag, idx) in allVisibleTags">
                    <v-divider v-if="idx > 0"/>
                    <v-list-item>
                        <template #prepend>
                            <v-checkbox :model-value="isTagChecked(accountTag, filterAccountTagIds)"
                                        @update:model-value="updateTagSelected(accountTag, $event)">
                                <template #label>
                                    <v-badge class="right-bottom-icon" color="secondary"
                                             location="bottom right" offset-x="2" offset-y="2" :icon="mdiEyeOffOutline"
                                             v-if="accountTag.hidden">
                                        <v-icon size="20" :icon="mdiPound"/>
                                    </v-badge>
                                    <v-icon size="20" :icon="mdiPound" v-else-if="!accountTag.hidden"/>
                                    <span class="ms-3">{{ accountTag.name }}</span>
                                </template>
                            </v-checkbox>
                        </template>
                    </v-list-item>
                </template>
            </v-list>
        </v-card-text>

        <v-card-text class="overflow-y-visible" v-if="dialogMode">
            <div class="w-100 d-flex justify-center flex-wrap mt-sm-1 mt-md-2 gap-4">
                <v-btn :disabled="!hasAnyAvailableTag" @click="save">{{ tt(applyText) }}</v-btn>
                <v-btn color="secondary" variant="tonal" @click="cancel">{{ tt('Cancel') }}</v-btn>
            </div>
        </v-card-text>
    </v-card>

    <snack-bar ref="snackbar" />
</template>

<script setup lang="ts">
import SnackBar from '@/components/desktop/SnackBar.vue';

import { useTemplateRef } from 'vue';

import { useI18n } from '@/locales/helpers.ts';
import {
    type AccountTagFilterType,
    useAccountTagFilterSettingPageBase
} from '@/views/base/settings/AccountTagFilterSettingPageBase.ts';

import { useAccountTagsStore } from '@/stores/accountTag.ts';

import type { AccountTag } from '@/models/account_tag.ts';

import {
    mdiMagnify,
    mdiSelectAll,
    mdiSelect,
    mdiSelectInverse,
    mdiEyeOutline,
    mdiEyeOffOutline,
    mdiDotsVertical,
    mdiPound
} from '@mdi/js';

type SnackBarType = InstanceType<typeof SnackBar>;

const props = defineProps<{
    type: AccountTagFilterType;
    dialogMode?: boolean;
    autoSave?: boolean;
}>();

const emit = defineEmits<{
    (e: 'settings:change', changed: boolean): void;
}>();

const { tt } = useI18n();

const {
    loading,
    showHidden,
    filterContent,
    filterAccountTagIds,
    title,
    applyText,
    allVisibleTags,
    allVisibleTagMap,
    hasAnyAvailableTag,
    hasAnyVisibleTag,
    isTagChecked,
    loadFilterTagIds,
    saveFilterTagIds
} = useAccountTagFilterSettingPageBase(props.type);

const accountTagsStore = useAccountTagsStore();

const snackbar = useTemplateRef<SnackBarType>('snackbar');

function init(): void {
    accountTagsStore.loadAllTags({
        force: false
    }).then(() => {
        loading.value = false;

        if (!loadFilterTagIds()) {
            snackbar.value?.showError('Parameter Invalid');
        }
    }).catch(error => {
        loading.value = false;

        if (!error.processed) {
            snackbar.value?.showError(error);
        }
    });
}

function updateTagSelected(accountTag: AccountTag, value: boolean | null): void {
    filterAccountTagIds.value[accountTag.id] = !value;

    if (props.autoSave) {
        save();
    }
}

function selectAllTags(): void {
    for (const tag of Object.values(allVisibleTagMap.value)) {
        filterAccountTagIds.value[tag.id] = false;
    }

    if (props.autoSave) {
        save();
    }
}

function selectNoneTags(): void {
    for (const tag of Object.values(allVisibleTagMap.value)) {
        filterAccountTagIds.value[tag.id] = true;
    }

    if (props.autoSave) {
        save();
    }
}

function selectInvertTags(): void {
    for (const tag of Object.values(allVisibleTagMap.value)) {
        filterAccountTagIds.value[tag.id] = !filterAccountTagIds.value[tag.id];
    }

    if (props.autoSave) {
        save();
    }
}

function save(): void {
    const changed = saveFilterTagIds();
    emit('settings:change', changed);
}

function cancel(): void {
    emit('settings:change', false);
}

init();
</script>
