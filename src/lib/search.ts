import { pinyin } from 'pinyin-pro';

export function matchSearchText(source: string | null | undefined, keyword: string | null | undefined): boolean {
    if (!keyword) {
        return true;
    }

    const normalizedKeyword = keyword.trim().toLowerCase();
    const normalizedKeywordNoSpace = normalizedKeyword.replace(/\s+/g, '');
    const hasKeywordNoSpace = normalizedKeywordNoSpace.length > 0;

    if (!normalizedKeyword) {
        return true;
    }

    const normalizedSource = (source || '').trim();

    if (!normalizedSource) {
        return false;
    }

    const lowerSource = normalizedSource.toLowerCase();

    if (lowerSource.includes(normalizedKeyword) || (hasKeywordNoSpace && lowerSource.includes(normalizedKeywordNoSpace))) {
        return true;
    }

    try {
        const pinyinList = pinyin(normalizedSource, { toneType: 'none', type: 'array' });
        const pinyinText = pinyinList
            .join('')
            .replace(/\s+/g, '')
            .toLowerCase();

        if (pinyinText && (pinyinText.includes(normalizedKeyword) || (hasKeywordNoSpace && pinyinText.includes(normalizedKeywordNoSpace)))) {
            return true;
        }

        const firstLetter = pinyinList
            .map(item => (item && item.length ? item[0] : ''))
            .join('')
            .replace(/\s+/g, '')
            .toLowerCase();

        return !!firstLetter && (firstLetter.includes(normalizedKeyword) || (hasKeywordNoSpace && firstLetter.includes(normalizedKeywordNoSpace)));
    } catch {
        return false;
    }
}
