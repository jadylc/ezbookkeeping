import { ref, computed } from 'vue';

import { useAccountTagsStore } from '@/stores/accountTag.ts';

import { AccountTag } from '@/models/account_tag.ts';

import { isNoAvailableAccountTag } from '@/lib/account_tag.ts';

export function useAccountTagListPageBase() {
    const accountTagsStore = useAccountTagsStore();

    const newTag = ref<AccountTag | null>(null);
    const editingTag = ref<AccountTag>(AccountTag.createNewTag());
    const loading = ref<boolean>(true);
    const showHidden = ref<boolean>(false);
    const displayOrderModified = ref<boolean>(false);

    const tags = computed<AccountTag[]>(() => accountTagsStore.allAccountTags);
    const noAvailableTag = computed<boolean>(() => isNoAvailableAccountTag(tags.value, showHidden.value));
    const hasEditingTag = computed<boolean>(() => !!(newTag.value || (editingTag.value.id && editingTag.value.id !== '')));

    function isTagModified(tag: AccountTag): boolean {
        if (tag.id) {
            return editingTag.value.name !== '' && editingTag.value.name !== tag.name;
        } else {
            return tag.name !== '';
        }
    }

    function add(): void {
        newTag.value = AccountTag.createNewTag('');
    }

    function edit(tag: AccountTag): void {
        editingTag.value.id = tag.id;
        editingTag.value.name = tag.name;
    }

    return {
        // states
        newTag,
        editingTag,
        loading,
        showHidden,
        displayOrderModified,
        // computed states
        tags,
        noAvailableTag,
        hasEditingTag,
        // functions
        isTagModified,
        add,
        edit
    };
}
