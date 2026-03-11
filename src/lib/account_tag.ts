import { reversed } from '@/core/base.ts';
import { AccountTag } from '@/models/account_tag.ts';

export function isNoAvailableAccountTag(tags: AccountTag[], showHidden: boolean): boolean {
    for (const tag of tags) {
        if (showHidden || !tag.hidden) {
            return false;
        }
    }

    return true;
}

export function getAvailableAccountTagCount(tags: AccountTag[], showHidden: boolean): number {
    let count = 0;

    for (const tag of tags) {
        if (showHidden || !tag.hidden) {
            count++;
        }
    }

    return count;
}

export function getFirstShowingAccountTagId(tags: AccountTag[], showHidden: boolean): string | null {
    for (const tag of tags) {
        if (showHidden || !tag.hidden) {
            return tag.id;
        }
    }

    return null;
}

export function getLastShowingAccountTagId(tags: AccountTag[], showHidden: boolean): string | null {
    for (const tag of reversed(tags)) {
        if (showHidden || !tag.hidden) {
            return tag.id;
        }
    }

    return null;
}
