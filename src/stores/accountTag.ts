import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

import { type BeforeResolveFunction, itemAndIndex } from '@/core/base.ts';

import {
    type AccountTagInfoResponse,
    type AccountTagNewDisplayOrderRequest,
    AccountTag
} from '@/models/account_tag.ts';

import { isEquals } from '@/lib/common.ts';

import logger from '@/lib/logger.ts';
import services, { type ApiResponsePromise } from '@/lib/services.ts';

export const useAccountTagsStore = defineStore('accountTags', () => {
    const allAccountTags = ref<AccountTag[]>([]);
    const allAccountTagsMap = ref<Record<string, AccountTag>>({});
    const allAccountTagsNameMap = ref<Record<string, AccountTag>>({});
    const accountTagListStateInvalid = ref<boolean>(true);

    const allAvailableTagsCount = computed<number>(() => allAccountTags.value.length);

    function loadAccountTagList(tags: AccountTag[]): void {
        allAccountTags.value = tags;
        allAccountTagsMap.value = {};
        allAccountTagsNameMap.value = {};

        for (const tag of tags) {
            allAccountTagsMap.value[tag.id] = tag;
            allAccountTagsNameMap.value[tag.name] = tag;
        }
    }

    function addTagToAccountTagList(tag: AccountTag): void {
        allAccountTags.value.push(tag);
        allAccountTagsMap.value[tag.id] = tag;
        allAccountTagsNameMap.value[tag.name] = tag;
    }

    function updateTagInAccountTagList(currentTag: AccountTag): void {
        const oldTag = allAccountTagsMap.value[currentTag.id];

        for (const [accountTag, index] of itemAndIndex(allAccountTags.value)) {
            if (accountTag.id === currentTag.id) {
                allAccountTags.value.splice(index, 1, currentTag);
                break;
            }
        }

        if (oldTag && oldTag.name !== currentTag.name) {
            delete allAccountTagsNameMap.value[oldTag.name];
        }

        allAccountTagsMap.value[currentTag.id] = currentTag;
        allAccountTagsNameMap.value[currentTag.name] = currentTag;
    }

    function updateTagDisplayOrderInAccountTagList({ from, to }: { from: number, to: number }): void {
        allAccountTags.value.splice(to, 0, allAccountTags.value.splice(from, 1)[0] as AccountTag);
    }

    function sortTagDisplayOrderByTagName(desc: boolean): boolean {
        const oldTags: AccountTag[] = [...allAccountTags.value];

        if (!desc) {
            allAccountTags.value.sort((a, b) => a.name.localeCompare(b.name, undefined, {
                numeric: true,
                sensitivity: 'base'
            }));
        } else {
            allAccountTags.value.sort((a, b) => b.name.localeCompare(a.name, undefined, {
                numeric: true,
                sensitivity: 'base'
            }));
        }

        const isOrderChanged = !isEquals(oldTags, allAccountTags.value);

        if (!isOrderChanged) {
            return false;
        }

        if (!accountTagListStateInvalid.value) {
            updateAccountTagListInvalidState(true);
        }

        return true;
    }

    function updateTagVisibilityInAccountTagList({ tag, hidden }: { tag: AccountTag, hidden: boolean }): void {
        if (allAccountTagsMap.value[tag.id]) {
            allAccountTagsMap.value[tag.id]!.hidden = hidden;
        }
    }

    function removeTagFromAccountTagList(currentTag: AccountTag): void {
        for (const [accountTag, index] of itemAndIndex(allAccountTags.value)) {
            if (accountTag.id === currentTag.id) {
                allAccountTags.value.splice(index, 1);
                break;
            }
        }

        if (allAccountTagsMap.value[currentTag.id]) {
            delete allAccountTagsMap.value[currentTag.id];
        }

        if (allAccountTagsNameMap.value[currentTag.name]) {
            delete allAccountTagsNameMap.value[currentTag.name];
        }
    }

    function updateAccountTagListInvalidState(invalidState: boolean): void {
        accountTagListStateInvalid.value = invalidState;
    }

    function resetAccountTags(): void {
        allAccountTags.value = [];
        allAccountTagsMap.value = {};
        allAccountTagsNameMap.value = {};
        accountTagListStateInvalid.value = true;
    }

    function loadAllTags({ force }: { force?: boolean }): Promise<AccountTag[]> {
        if (!force && !accountTagListStateInvalid.value) {
            return new Promise((resolve) => {
                resolve(allAccountTags.value);
            });
        }

        return new Promise((resolve, reject) => {
            services.getAllAccountTags().then(response => {
                const data = response.data;

                if (!data || !data.success || !data.result) {
                    reject({ message: 'Unable to retrieve tag list' });
                    return;
                }

                if (accountTagListStateInvalid.value) {
                    updateAccountTagListInvalidState(false);
                }

                const accountTags = AccountTag.ofMulti(data.result);

                if (force && data.result && isEquals(allAccountTags.value, accountTags)) {
                    reject({ message: 'Tag list is up to date', isUpToDate: true });
                    return;
                }

                loadAccountTagList(accountTags);

                resolve(accountTags);
            }).catch(error => {
                if (force) {
                    logger.error('failed to force load tag list', error);
                } else {
                    logger.error('failed to load tag list', error);
                }

                if (error.response && error.response.data && error.response.data.errorMessage) {
                    reject({ error: error.response.data });
                } else if (!error.processed) {
                    reject({ message: 'Unable to retrieve tag list' });
                } else {
                    reject(error);
                }
            });
        });
    }

    function saveTag({ tag, beforeResolve }: { tag: AccountTag, beforeResolve?: BeforeResolveFunction }): Promise<AccountTag> {
        return new Promise((resolve, reject) => {
            let promise: ApiResponsePromise<AccountTagInfoResponse>;

            if (!tag.id) {
                promise = services.addAccountTag(tag.toCreateRequest());
            } else {
                promise = services.modifyAccountTag(tag.toModifyRequest());
            }

            promise.then(response => {
                const data = response.data;

                if (!data || !data.success || !data.result) {
                    if (!tag.id) {
                        reject({ message: 'Unable to add tag' });
                    } else {
                        reject({ message: 'Unable to save tag' });
                    }
                    return;
                }

                const accountTag = AccountTag.of(data.result);

                if (beforeResolve) {
                    beforeResolve(() => {
                        if (!tag.id) {
                            addTagToAccountTagList(accountTag);
                        } else {
                            updateTagInAccountTagList(accountTag);
                        }
                    });
                } else {
                    if (!tag.id) {
                        addTagToAccountTagList(accountTag);
                    } else {
                        updateTagInAccountTagList(accountTag);
                    }
                }

                resolve(accountTag);
            }).catch(error => {
                logger.error('failed to save tag', error);

                if (error.response && error.response.data && error.response.data.errorMessage) {
                    reject({ error: error.response.data });
                } else if (!error.processed) {
                    if (!tag.id) {
                        reject({ message: 'Unable to add tag' });
                    } else {
                        reject({ message: 'Unable to save tag' });
                    }
                } else {
                    reject(error);
                }
            });
        });
    }

    function changeTagDisplayOrder({ tagId, from, to }: { tagId: string, from: number, to: number }): Promise<void> {
        return new Promise((resolve, reject) => {
            const currentTag = allAccountTagsMap.value[tagId];

            if (!currentTag || !allAccountTags.value[to]) {
                reject({ message: 'Unable to move tag' });
                return;
            }

            if (!accountTagListStateInvalid.value) {
                updateAccountTagListInvalidState(true);
            }

            updateTagDisplayOrderInAccountTagList({ from, to });

            resolve();
        });
    }

    function updateTagDisplayOrders(): Promise<boolean> {
        const newDisplayOrders: AccountTagNewDisplayOrderRequest[] = [];

        for (const [accountTag, index] of itemAndIndex(allAccountTags.value)) {
            newDisplayOrders.push({
                id: accountTag.id,
                displayOrder: index + 1
            });
        }

        return new Promise((resolve, reject) => {
            services.moveAccountTag({
                newDisplayOrders: newDisplayOrders
            }).then(response => {
                const data = response.data;

                if (!data || !data.success || !data.result) {
                    reject({ message: 'Unable to move tag' });
                    return;
                }

                loadAllTags({ force: false }).finally(() => {
                    if (accountTagListStateInvalid.value) {
                        updateAccountTagListInvalidState(false);
                    }

                    resolve(data.result);
                });
            }).catch(error => {
                logger.error('failed to save tags display order', error);

                if (error.response && error.response.data && error.response.data.errorMessage) {
                    reject({ error: error.response.data });
                } else if (!error.processed) {
                    reject({ message: 'Unable to move tag' });
                } else {
                    reject(error);
                }
            });
        });
    }

    function hideTag({ tag, hidden }: { tag: AccountTag, hidden: boolean }): Promise<boolean> {
        return new Promise((resolve, reject) => {
            services.hideAccountTag({
                id: tag.id,
                hidden: hidden
            }).then(response => {
                const data = response.data;

                if (!data || !data.success || !data.result) {
                    if (hidden) {
                        reject({ message: 'Unable to hide this tag' });
                    } else {
                        reject({ message: 'Unable to unhide this tag' });
                    }
                    return;
                }

                updateTagVisibilityInAccountTagList({ tag, hidden });

                resolve(data.result);
            }).catch(error => {
                logger.error('failed to change tag visibility', error);

                if (error.response && error.response.data && error.response.data.errorMessage) {
                    reject({ error: error.response.data });
                } else if (!error.processed) {
                    if (hidden) {
                        reject({ message: 'Unable to hide this tag' });
                    } else {
                        reject({ message: 'Unable to unhide this tag' });
                    }
                } else {
                    reject(error);
                }
            });
        });
    }

    function deleteTag({ tag, beforeResolve }: { tag: AccountTag, beforeResolve?: BeforeResolveFunction }): Promise<boolean> {
        return new Promise((resolve, reject) => {
            services.deleteAccountTag({
                id: tag.id
            }).then(response => {
                const data = response.data;

                if (!data || !data.success || !data.result) {
                    reject({ message: 'Unable to delete this tag' });
                    return;
                }

                if (beforeResolve) {
                    beforeResolve(() => {
                        removeTagFromAccountTagList(tag);
                    });
                } else {
                    removeTagFromAccountTagList(tag);
                }

                resolve(data.result);
            }).catch(error => {
                logger.error('failed to delete tag', error);

                if (error.response && error.response.data && error.response.data.errorMessage) {
                    reject({ error: error.response.data });
                } else if (!error.processed) {
                    reject({ message: 'Unable to delete this tag' });
                } else {
                    reject(error);
                }
            });
        });
    }

    return {
        // states
        allAccountTags,
        allAccountTagsMap,
        allAccountTagsNameMap,
        accountTagListStateInvalid,
        // computed states
        allAvailableTagsCount,
        // functions
        sortTagDisplayOrderByTagName,
        updateAccountTagListInvalidState,
        resetAccountTags,
        loadAllTags,
        saveTag,
        changeTagDisplayOrder,
        updateTagDisplayOrders,
        hideTag,
        deleteTag
    };
});
