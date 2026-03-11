<template>
    <f7-sheet ref="sheet" swipe-to-close swipe-handler=".swipe-handler"
              style="height: auto" :opened="show"
              @sheet:open="onSheetOpen" @sheet:closed="onSheetClosed">
        <f7-toolbar class="toolbar-with-swipe-handler">
            <div class="swipe-handler"></div>
            <div class="left">
                <f7-link sheet-close icon-f7="xmark"></f7-link>
            </div>
            <f7-searchbar ref="searchbar" custom-searchs
                          :value="tagSearchContent"
                          :placeholder="tt('Find tag')"
                          :disable-button="false"
                          v-if="enableFilter"
                          @input="tagSearchContent = $event.target.value"
                          @focus="onSearchBarFocus">
            </f7-searchbar>
            <div class="right">
                <f7-button round fill icon-f7="checkmark_alt" @click="save"
                           v-if="filteredTags && filteredTags.length > 0"></f7-button>
            </div>
        </f7-toolbar>
        <f7-page-content :class="'margin-top ' + heightClass">
            <f7-list class="no-margin-top no-margin-bottom" v-if="(!filteredTags || filteredTags.length < 1)">
                <f7-list-item :title="tt('No available tag')"></f7-list-item>
            </f7-list>
            <f7-list dividers class="no-margin-top no-margin-bottom tag-selection-list" v-else>
                <f7-list-item checkbox
                              :class="{ 'list-item-selected': selectedTagNames[tag.name], 'disabled': tag.hidden && !selectedTagNames[tag.name] }"
                              :value="tag.name"
                              :checked="selectedTagNames[tag.name]"
                              :key="tag.id"
                              v-for="tag in filteredTags"
                              @change="changeTagSelection">
                    <template #media>
                        <f7-icon class="transaction-tag-icon" f7="number">
                            <f7-badge color="gray" class="right-bottom-icon" v-if="tag.hidden">
                                <f7-icon f7="eye_slash_fill"></f7-icon>
                            </f7-badge>
                        </f7-icon>
                    </template>
                    <template #title>
                        <div class="display-flex">
                            <div class="tag-selection-list-item list-item-valign-middle padding-inline-start-half">
                                {{ tag.name }}
                            </div>
                        </div>
                    </template>
                </f7-list-item>
            </f7-list>
        </f7-page-content>
    </f7-sheet>
</template>

<script setup lang="ts">
import { ref, computed, useTemplateRef } from 'vue';
import type { Sheet, Searchbar } from 'framework7/types';

import { useI18n } from '@/locales/helpers.ts';
import type { AccountTag } from '@/models/account_tag.ts';

import { matchSearchText } from '@/lib/search.ts';
import { scrollToSelectedItem } from '@/lib/ui/common.ts';
import { type Framework7Dom, scrollSheetToTop } from '@/lib/ui/mobile.ts';

const props = defineProps<{
    modelValue: string[];
    tags: AccountTag[];
    title?: string;
    enableFilter?: boolean;
    show: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string[]): void;
    (e: 'update:show', value: boolean): void;
}>();

const { tt } = useI18n();

const sheet = useTemplateRef<Sheet.Sheet>('sheet');
const searchbar = useTemplateRef<Searchbar.Searchbar>('searchbar');

const clonedModelValue = ref<string[]>([]);
const tagSearchContent = ref<string>('');

const selectedTagNames = computed<Record<string, boolean>>(() => {
    const selected: Record<string, boolean> = {};

    for (const tagName of clonedModelValue.value) {
        selected[tagName] = true;
    }

    return selected;
});

const filteredTags = computed<AccountTag[]>(() => {
    if (!props.tags || props.tags.length < 1) {
        return [];
    }

    if (!props.enableFilter || !tagSearchContent.value) {
        return props.tags;
    }

    const keyword = tagSearchContent.value;
    const result: AccountTag[] = [];

    for (const tag of props.tags) {
        if (matchSearchText(tag.name, keyword)) {
            result.push(tag);
        }
    }

    return result;
});

const heightClass = computed<string>(() => {
    if (filteredTags.value.length > 6) {
        return 'tag-selection-huge-sheet';
    } else if (filteredTags.value.length > 3) {
        return 'tag-selection-large-sheet';
    } else {
        return 'tag-selection-default-sheet';
    }
});

function changeTagSelection(e: Event): void {
    const target = e.target as HTMLInputElement;
    const tagName = target.value;
    const index = clonedModelValue.value.indexOf(tagName);

    if (target.checked) {
        if (index < 0) {
            clonedModelValue.value.push(tagName);
        }
    } else {
        if (index >= 0) {
            clonedModelValue.value.splice(index, 1);
        }
    }
}

function save(): void {
    emit('update:modelValue', clonedModelValue.value);
    emit('update:show', false);
}

function onSearchBarFocus(): void {
    if (!sheet.value) {
        return;
    }

    scrollSheetToTop(sheet.value?.$el as HTMLElement, window.innerHeight); // $el is not Framework7 Dom
}

function onSheetOpen(event: { $el: Framework7Dom }): void {
    clonedModelValue.value = props.modelValue ? [...props.modelValue] : [];
    scrollToSelectedItem(event.$el[0], '.sheet-modal-inner', '.page-content', 'li.list-item-selected');
}

function onSheetClosed(): void {
    emit('update:show', false);
    tagSearchContent.value = '';
    searchbar.value?.clear();
}
</script>

<style>
.tag-selection-default-sheet {
    height: 310px;
}

@media (min-height: 630px) {
    .tag-selection-large-sheet {
        height: 370px;
    }

    .tag-selection-huge-sheet {
        height: 500px;
    }
}

@media (max-height: 629px) {
    .tag-selection-large-sheet,
    .tag-selection-huge-sheet {
        height: 320px;
    }
}
</style>
