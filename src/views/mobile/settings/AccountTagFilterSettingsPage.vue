<template>
    <f7-page with-subnavbar @page:beforein="onPageBeforeIn" @page:afterin="onPageAfterIn">
        <f7-navbar>
            <f7-nav-left :class="{ 'disabled': loading }" :back-link="tt('Back')"></f7-nav-left>
            <f7-nav-title :title="tt(title)"></f7-nav-title>
            <f7-nav-right :class="{ 'navbar-compact-icons': true, 'disabled': loading }">
                <f7-link icon-f7="ellipsis" :class="{ 'disabled': !hasAnyAvailableTag }" @click="showMoreActionSheet = true"></f7-link>
                <f7-link icon-f7="checkmark_alt" :class="{ 'disabled': !hasAnyAvailableTag }" @click="save"></f7-link>
            </f7-nav-right>

            <f7-subnavbar :inner="false">
                <f7-searchbar
                    custom-searchs
                    :class="{ 'disabled': loading }"
                    :value="filterContent"
                    :placeholder="tt('Find tag')"
                    :disable-button-text="tt('Cancel')"
                    @change="filterContent = $event.target.value"
                ></f7-searchbar>
            </f7-subnavbar>
        </f7-navbar>

        <f7-list strong inset dividers class="tag-item-list margin-top skeleton-text" v-if="loading">
            <f7-list-item :key="itemIdx" v-for="itemIdx in [ 1, 2, 3 ]">
                <template #media>
                    <f7-icon class="transaction-tag-icon" f7="number"></f7-icon>
                </template>
                <template #title>
                    <div class="display-flex">
                        <div class="transaction-tag-list-item-content list-item-valign-middle padding-inline-start-half">Tag Name</div>
                    </div>
                </template>
            </f7-list-item>
        </f7-list>

        <f7-list strong inset dividers class="margin-top" v-if="!loading && !hasAnyVisibleTag">
            <f7-list-item :title="tt('No available tag')"></f7-list-item>
        </f7-list>

        <f7-list strong inset dividers class="margin-top" v-if="!loading && hasAnyVisibleTag">
            <f7-list-item checkbox
                          :title="accountTag.name"
                          :value="accountTag.id"
                          :checked="isTagChecked(accountTag, filterAccountTagIds)"
                          :key="accountTag.id"
                          v-for="accountTag in allVisibleTags"
                          @change="updateTagSelected">
                <template #media>
                    <f7-icon class="transaction-tag-icon" f7="number">
                        <f7-badge color="gray" class="right-bottom-icon" v-if="accountTag.hidden">
                            <f7-icon f7="eye_slash_fill"></f7-icon>
                        </f7-badge>
                    </f7-icon>
                </template>
            </f7-list-item>
        </f7-list>

        <f7-actions close-by-outside-click close-on-escape :opened="showMoreActionSheet" @actions:closed="showMoreActionSheet = false">
            <f7-actions-group>
                <f7-actions-button :class="{ 'disabled': !hasAnyVisibleTag }" @click="selectAllTags">{{ tt('Select All') }}</f7-actions-button>
                <f7-actions-button :class="{ 'disabled': !hasAnyVisibleTag }" @click="selectNoneTags">{{ tt('Select None') }}</f7-actions-button>
                <f7-actions-button :class="{ 'disabled': !hasAnyVisibleTag }" @click="selectInvertTags">{{ tt('Invert Selection') }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group>
                <f7-actions-button v-if="!showHidden" @click="showHidden = true">{{ tt('Show Hidden Account Tags') }}</f7-actions-button>
                <f7-actions-button v-if="showHidden" @click="showHidden = false">{{ tt('Hide Hidden Account Tags') }}</f7-actions-button>
            </f7-actions-group>
            <f7-actions-group>
                <f7-actions-button bold close>{{ tt('Cancel') }}</f7-actions-button>
            </f7-actions-group>
        </f7-actions>
    </f7-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Router } from 'framework7/types';

import { useI18n } from '@/locales/helpers.ts';
import { useI18nUIComponents } from '@/lib/ui/mobile.ts';
import {
    type AccountTagFilterType,
    useAccountTagFilterSettingPageBase
} from '@/views/base/settings/AccountTagFilterSettingPageBase.ts';

import { useAccountTagsStore } from '@/stores/accountTag.ts';

const props = defineProps<{
    f7route: Router.Route;
    f7router: Router.Router;
}>();

const query = props.f7route.query;

const { tt } = useI18n();
const { showToast, routeBackOnError } = useI18nUIComponents();

const {
    loading,
    showHidden,
    filterContent,
    filterAccountTagIds,
    title,
    allVisibleTags,
    allVisibleTagMap,
    hasAnyAvailableTag,
    hasAnyVisibleTag,
    isTagChecked,
    loadFilterTagIds,
    saveFilterTagIds
} = useAccountTagFilterSettingPageBase(query['type'] as AccountTagFilterType);

const accountTagsStore = useAccountTagsStore();

const loadingError = ref<unknown | null>(null);
const showMoreActionSheet = ref<boolean>(false);

function init(): void {
    accountTagsStore.loadAllTags({
        force: false
    }).then(() => {
        loading.value = false;

        if (!loadFilterTagIds()) {
            showToast('Parameter Invalid');
            loadingError.value = 'Parameter Invalid';
        }
    }).catch(error => {
        if (error.processed) {
            loading.value = false;
        } else {
            loadingError.value = error;
            showToast(error.message || error);
        }
    });
}

function updateTagSelected(e: Event): void {
    const target = e.target as HTMLInputElement;
    const tagId = target.value;
    const tag = allVisibleTagMap.value[tagId];

    if (!tag) {
        return;
    }

    filterAccountTagIds.value[tag.id] = !target.checked;
}

function selectAllTags(): void {
    for (const tag of Object.values(allVisibleTagMap.value)) {
        filterAccountTagIds.value[tag.id] = false;
    }
}

function selectNoneTags(): void {
    for (const tag of Object.values(allVisibleTagMap.value)) {
        filterAccountTagIds.value[tag.id] = true;
    }
}

function selectInvertTags(): void {
    for (const tag of Object.values(allVisibleTagMap.value)) {
        filterAccountTagIds.value[tag.id] = !filterAccountTagIds.value[tag.id];
    }
}

function save(): void {
    saveFilterTagIds();
    props.f7router.back();
}

function onPageBeforeIn(): void {
    filterContent.value = '';
}

function onPageAfterIn(): void {
    routeBackOnError(props.f7router, loadingError);
}

init();
</script>

<style>
.tag-item-list.list .item-media + .item-inner {
    margin-inline-start: 5px;
}

.transaction-tag-list-item-content {
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
