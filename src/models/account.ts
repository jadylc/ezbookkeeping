import type { HiddenAmount, NumberWithSuffix } from '@/core/numeral.ts';
import type { ColorValue } from '@/core/color.ts';
import { AccountType, AccountCategory } from '@/core/account.ts';
import { DEFAULT_ACCOUNT_COLOR } from '@/consts/color.ts';

export class Account implements AccountInfoResponse {
    public id: string;
    public name: string;
    public category: number;
    public type: number;
    public icon: string;
    public color: ColorValue;
    public currency: string;
    public balance: number;
    public balanceTime?: number;
    public comment: string;
    public tag: string;
    public tags: string[];
    public creditCardStatementDate?: number;
    public displayOrder: number;
    public visible: boolean;

    private readonly _isAsset?: boolean;
    private readonly _isLiability?: boolean;

    protected constructor(id: string, name: string, category: number, type: number, icon: string, color: string, currency: string, balance: number, comment: string, tag: string, tags: string[] | undefined, displayOrder: number, visible: boolean, balanceTime?: number, creditCardStatementDate?: number, isAsset?: boolean, isLiability?: boolean) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.type = type;
        this.icon = icon;
        this.color = color;
        this.currency = currency;
        this.balance = balance;
        this.balanceTime = balanceTime;
        this.comment = comment;
        this.tags = tags && tags.length ? [...tags] : (tag ? [tag] : []);
        this.tag = tag || (this.tags.length ? (this.tags[0] ?? '') : '');
        this.displayOrder = displayOrder;
        this.visible = visible;
        this.creditCardStatementDate = creditCardStatementDate;
        this._isAsset = isAsset;
        this._isLiability = isLiability;
    }

    public get isAsset(): boolean {
        if (typeof(this._isAsset) !== 'undefined') {
            return this._isAsset;
        }

        const accountCategory = AccountCategory.valueOf(this.category);

        if (accountCategory) {
            return accountCategory.isAsset;
        }

        return false;
    }

    public get isLiability(): boolean {
        if (typeof(this._isLiability) !== 'undefined') {
            return this._isLiability;
        }

        const accountCategory = AccountCategory.valueOf(this.category);

        if (accountCategory) {
            return accountCategory.isLiability;
        }

        return false;
    }

    public get hidden(): boolean {
        return !this.visible;
    }

    public equals(other: Account): boolean {
        const isEqual = this.id === other.id &&
            this.name === other.name &&
            this.category === other.category &&
            this.type === other.type &&
            this.icon === other.icon &&
            this.color === other.color &&
            this.currency === other.currency &&
            this.balance === other.balance &&
            this.balanceTime === other.balanceTime &&
            this.comment === other.comment &&
            this.tag === other.tag &&
            JSON.stringify(this.tags) === JSON.stringify(other.tags) &&
            this.displayOrder === other.displayOrder &&
            this.visible === other.visible &&
            this.creditCardStatementDate === other.creditCardStatementDate;

        if (!isEqual) {
            return false;
        }

        return true;
    }

    public fillFrom(other: Account): void {
        this.id = other.id;
        this.category = other.category;
        this.type = other.type;
        this.name = other.name;
        this.icon = other.icon;
        this.color = other.color;
        this.currency = other.currency;
        this.balance = other.balance;
        this.balanceTime = other.balanceTime;
        this.comment = other.comment;
        this.tag = other.tag;
        this.tags = [...other.tags];
        this.creditCardStatementDate = other.creditCardStatementDate;
        this.visible = other.visible;
    }

    public setSuitableIcon(oldCategory: number, newCategory: number): void {
        const allCategories = AccountCategory.values();

        for (const category of allCategories) {
            if (category.type === oldCategory) {
                if (this.icon !== category.defaultAccountIconId) {
                    return;
                } else {
                    break;
                }
            }
        }

        for (const category of allCategories) {
            if (category.type === newCategory) {
                this.icon = category.defaultAccountIconId;
            }
        }
    }

    public toCreateRequest(clientSessionId: string): AccountCreateRequest {
        return {
            name: this.name,
            category: this.category,
            type: AccountType.SingleAccount.type,
            icon: this.icon,
            color: this.color,
            currency: this.currency,
            balance: this.balance,
            balanceTime: this.balanceTime || 0,
            comment: this.comment,
            tag: this.tags && this.tags.length ? (this.tags[0] ?? '') : this.tag,
            tags: this.tags,
            creditCardStatementDate: this.category === AccountCategory.CreditCard.type ? this.creditCardStatementDate : undefined,
            clientSessionId: clientSessionId
        };
    }

    public toModifyRequest(clientSessionId: string): AccountModifyRequest {
        return {
            id: this.id || '0',
            name: this.name,
            category: this.category,
            icon: this.icon,
            color: this.color,
            currency: this.currency,
            balance: this.balance,
            comment: this.comment,
            tag: this.tags && this.tags.length ? (this.tags[0] ?? '') : this.tag,
            tags: this.tags,
            creditCardStatementDate: this.category === AccountCategory.CreditCard.type ? this.creditCardStatementDate : undefined,
            hidden: !this.visible,
            clientSessionId: clientSessionId
        };
    }

    public cloneSelf(): Account {
        return new Account(
            this.id,
            this.name,
            this.category,
            this.type,
            this.icon,
            this.color,
            this.currency,
            this.balance,
            this.comment,
            this.tag,
            this.tags,
            this.displayOrder,
            this.visible,
            this.balanceTime,
            this.creditCardStatementDate,
            this.isAsset,
            this.isLiability
        );
    }

    public clone(): Account {
        return new Account(
            this.id,
            this.name,
            this.category,
            this.type,
            this.icon,
            this.color,
            this.currency,
            this.balance,
            this.comment,
            this.tag,
            this.tags,
            this.displayOrder,
            this.visible,
            this.balanceTime,
            this.creditCardStatementDate,
            this.isAsset,
            this.isLiability
        );
    }

    public static createNewAccount(accountCategory: AccountCategory, currency: string, balanceTime: number): Account {
        return new Account(
            '', // id
            '', // name
            accountCategory.type, // category
            AccountType.SingleAccount.type, // type
            accountCategory.defaultAccountIconId, // icon
            DEFAULT_ACCOUNT_COLOR, // color
            currency, // currency
            0, // balance
            '', // comment
            '', // tag
            [], // tags
            0, // displayOrder
            true, // visible
            balanceTime, // balanceTime
            0 // creditCardStatementDate
        );
    }

    public static of(accountResponse: AccountInfoResponse): Account {
        return new Account(
            accountResponse.id,
            accountResponse.name,
            accountResponse.category,
            accountResponse.type,
            accountResponse.icon,
            accountResponse.color,
            accountResponse.currency,
            accountResponse.balance,
            accountResponse.comment,
            accountResponse.tag,
            accountResponse.tags,
            accountResponse.displayOrder,
            !accountResponse.hidden,
            undefined,
            accountResponse.creditCardStatementDate,
            accountResponse.isAsset,
            accountResponse.isLiability
        );
    }

    public static ofMulti(accountResponses: AccountInfoResponse[]): Account[] {
        const accounts: Account[] = [];

        for (const accountResponse of accountResponses) {
            accounts.push(Account.of(accountResponse));
        }

        return accounts;
    }

    public static findAccountNameById(accounts: Account[], accountId: string, defaultName?: string): string | undefined {
        for (const account of accounts) {
            if (account.id === accountId) {
                return account.name;
            }
        }

        return defaultName;
    }

    public static cloneAccounts(accounts: Account[]): Account[] {
        const clonedAccounts: Account[] = [];

        for (const account of accounts) {
            clonedAccounts.push(account.clone());
        }

        return clonedAccounts;
    }

    public static sortAccounts(accounts: Account[], accountCategoryDisplayOrders: Record<number, number>): Account[] {
        if (!accounts || !accounts.length) {
            return accounts;
        }

        return accounts.sort(function (account1, account2) {
            if (account1.category !== account2.category) {
                const account1CategoryDisplayOrder = accountCategoryDisplayOrders[account1.category];
                const account2CategoryDisplayOrder = accountCategoryDisplayOrders[account2.category];

                if (!account1CategoryDisplayOrder) {
                    return 1;
                }

                if (!account2CategoryDisplayOrder) {
                    return -1;
                }

                return account1CategoryDisplayOrder - account2CategoryDisplayOrder;
            }

            if (account1.displayOrder !== account2.displayOrder) {
                return account1.displayOrder - account2.displayOrder;
            }

            return account1.id.localeCompare(account2.id);
        });
    }
}

export class AccountWithDisplayBalance extends Account {
    public displayBalance: string;

    private constructor(account: Account, displayBalance: string) {
        super(
            account.id,
            account.name,
            account.category,
            account.type,
            account.icon,
            account.color,
            account.currency,
            account.balance,
            account.comment,
            account.tag,
            account.tags,
            account.displayOrder,
            account.visible,
            account.balanceTime,
            account.creditCardStatementDate,
            account.isAsset,
            account.isLiability
        );

        this.displayBalance = displayBalance;
    }

    public static fromAccount(account: Account, displayBalance: string): AccountWithDisplayBalance {
        return new AccountWithDisplayBalance(account, displayBalance);
    }
}

export interface AccountCreateRequest {
    readonly name: string;
    readonly category: number;
    readonly type: number;
    readonly icon: string;
    readonly color: string;
    readonly currency: string;
    readonly balance: number;
    readonly balanceTime: number;
    readonly comment: string;
    readonly tag: string;
    readonly tags: string[];
    readonly creditCardStatementDate?: number;
    readonly clientSessionId?: string;
}

export interface AccountModifyRequest {
    readonly id: string;
    readonly name: string;
    readonly category: number;
    readonly icon: string;
    readonly color: string;
    readonly currency?: string;
    readonly balance?: number;
    readonly balanceTime?: number;
    readonly comment: string;
    readonly tag: string;
    readonly tags: string[];
    readonly creditCardStatementDate?: number;
    readonly hidden: boolean;
    readonly clientSessionId?: string;
}

export interface AccountInfoResponse {
    readonly id: string;
    readonly name: string;
    readonly category: number;
    readonly type: number;
    readonly icon: string;
    readonly color: string;
    readonly currency: string;
    readonly balance: number;
    readonly comment: string;
    readonly tag: string;
    readonly tags?: string[];
    readonly creditCardStatementDate?: number;
    readonly displayOrder: number;
    readonly isAsset?: boolean;
    readonly isLiability?: boolean;
    readonly hidden: boolean;
}

export interface AccountHideRequest {
    readonly id: string;
    readonly hidden: boolean;
}

export interface AccountMoveRequest {
    readonly newDisplayOrders: AccountNewDisplayOrderRequest[];
}

export interface AccountNewDisplayOrderRequest {
    readonly id: string;
    readonly displayOrder: number;
}

export interface AccountDeleteRequest {
    readonly id: string;
}

export interface AccountBalance {
    readonly balance: number;
    readonly isAsset: boolean;
    readonly isLiability: boolean;
    readonly currency: string;
}

export interface AccountDisplayBalance {
    readonly balance: number | HiddenAmount | NumberWithSuffix;
    readonly currency: string;
}

export interface CategorizedAccount {
    readonly category: number;
    readonly name: string;
    readonly icon: string;
    readonly accounts: Account[];
}

export class CategorizedAccountWithDisplayBalance {
    public category: number;
    public name: string;
    public icon: string;
    public accounts: AccountWithDisplayBalance[];
    public displayBalance: string;

    private constructor(category: number, name: string, icon: string, accounts: AccountWithDisplayBalance[], displayBalance: string) {
        this.category = category;
        this.name = name;
        this.icon = icon;
        this.accounts = accounts;
        this.displayBalance = displayBalance;
    }

    public static of(categorizedAccount: CategorizedAccount, accounts: AccountWithDisplayBalance[], displayBalance: string): CategorizedAccountWithDisplayBalance {
        return new CategorizedAccountWithDisplayBalance(categorizedAccount.category, categorizedAccount.name, categorizedAccount.icon, accounts, displayBalance);
    }
}

export interface AccountShowingIds {
    readonly accounts: Record<number, string>;
}
