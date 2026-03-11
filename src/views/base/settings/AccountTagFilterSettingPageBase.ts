import { ref, computed } from 'vue';

import { useAccountTagsStore } from '@/stores/accountTag.ts';
import { useSettingsStore } from '@/stores/setting.ts';
import { useStatisticsStore } from '@/stores/statistics.ts';

import { values } from '@/core/base.ts';
import type { AccountTag } from '@/models/account_tag.ts';
import { matchSearchText } from '@/lib/search.ts';

export type AccountTagFilterType = 'statisticsCurrent' | 'accountListTotalAmount';

export function useAccountTagFilterSettingPageBase(type?: AccountTagFilterType) {
    const accountTagsStore = useAccountTagsStore();
    const settingsStore = useSettingsStore();
    const statisticsStore = useStatisticsStore();

    const loading = ref<boolean>(true);
    const showHidden = ref<boolean>(false);
    const filterContent = ref<string>('');
    const filterAccountTagIds = ref<Record<string, boolean>>({});

    const title = computed<string>(() => {
        return 'Filter Account Tags';
    });

    const applyText = computed<string>(() => {
        return 'Apply';
    });

    const allVisibleTags = computed<AccountTag[]>(() => {
        const visibleTags: AccountTag[] = [];

        for (const tag of accountTagsStore.allAccountTags) {
            if (!showHidden.value && tag.hidden) {
                continue;
            }

            if (filterContent.value && !matchSearchText(tag.name, filterContent.value)) {
                continue;
            }

            visibleTags.push(tag);
        }

        return visibleTags;
    });

    const allVisibleTagMap = computed<Record<string, AccountTag>>(() => {
        const tagMap: Record<string, AccountTag> = {};

        for (const tag of allVisibleTags.value) {
            tagMap[tag.id] = tag;
        }

        return tagMap;
    });

    const hasAnyAvailableTag = computed<boolean>(() => accountTagsStore.allAvailableTagsCount > 0);
    const hasAnyVisibleTag = computed<boolean>(() => allVisibleTags.value.length > 0);

    function isTagChecked(tag: AccountTag, filterIds: Record<string, boolean>): boolean {
        return !filterIds[tag.id];
    }

    function loadFilterTagIds(): boolean {
        const allTagIds: Record<string, boolean> = {};

        for (const tag of values(accountTagsStore.allAccountTagsMap)) {
            allTagIds[tag.id] = false;
        }

        if (type === 'statisticsCurrent') {
            filterAccountTagIds.value = Object.assign(allTagIds, statisticsStore.transactionStatisticsFilter.filterAccountTagIds);
            return true;
        } else if (type === 'accountListTotalAmount') {
            filterAccountTagIds.value = Object.assign(allTagIds, settingsStore.appSettings.totalAmountExcludeAccountTagIds);
            return true;
        }

        return false;
    }

    function saveFilterTagIds(): boolean {
        const filteredTagIds: Record<string, boolean> = {};
        let changed = true;

        for (const tagId of Object.keys(filterAccountTagIds.value)) {
            if (filterAccountTagIds.value[tagId]) {
                filteredTagIds[tagId] = true;
            }
        }

        if (type === 'statisticsCurrent') {
            changed = statisticsStore.updateTransactionStatisticsFilter({
                filterAccountTagIds: filteredTagIds
            });

            if (changed) {
                statisticsStore.updateTransactionStatisticsInvalidState(true);
            }
        } else if (type === 'accountListTotalAmount') {
            settingsStore.setTotalAmountExcludeAccountTagIds(filteredTagIds);
        }

        return changed;
    }

    return {
        // states
        loading,
        showHidden,
        filterContent,
        filterAccountTagIds,
        // computed states
        title,
        applyText,
        allVisibleTags,
        allVisibleTagMap,
        hasAnyAvailableTag,
        hasAnyVisibleTag,
        // functions
        isTagChecked,
        loadFilterTagIds,
        saveFilterTagIds
    };
}
