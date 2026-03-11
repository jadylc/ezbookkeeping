export class AccountTag implements AccountTagInfoResponse {
    public id: string;
    public name: string;
    public displayOrder: number;
    public hidden: boolean;

    private constructor(id: string, name: string, displayOrder: number, hidden: boolean) {
        this.id = id;
        this.name = name;
        this.displayOrder = displayOrder;
        this.hidden = hidden;
    }

    public toCreateRequest(): AccountTagCreateRequest {
        return {
            name: this.name
        };
    }

    public toModifyRequest(): AccountTagModifyRequest {
        return {
            id: this.id,
            name: this.name
        };
    }

    public clone(): AccountTag {
        return new AccountTag(this.id, this.name, this.displayOrder, this.hidden);
    }

    public static of(tagResponse: AccountTagInfoResponse): AccountTag {
        return new AccountTag(tagResponse.id, tagResponse.name, tagResponse.displayOrder, tagResponse.hidden);
    }

    public static ofMulti(tagResponses: AccountTagInfoResponse[]): AccountTag[] {
        const tags: AccountTag[] = [];

        for (const tagResponse of tagResponses) {
            tags.push(AccountTag.of(tagResponse));
        }

        return tags;
    }

    public static createNewTag(name?: string): AccountTag {
        return new AccountTag('', name || '', 0, false);
    }
}

export interface AccountTagCreateRequest {
    readonly name: string;
}

export interface AccountTagModifyRequest {
    readonly id: string;
    readonly name: string;
}

export interface AccountTagHideRequest {
    readonly id: string;
    readonly hidden: boolean;
}

export interface AccountTagMoveRequest {
    readonly newDisplayOrders: AccountTagNewDisplayOrderRequest[];
}

export interface AccountTagNewDisplayOrderRequest {
    readonly id: string;
    readonly displayOrder: number;
}

export interface AccountTagDeleteRequest {
    readonly id: string;
}

export interface AccountTagInfoResponse {
    readonly id: string;
    readonly name: string;
    readonly displayOrder: number;
    readonly hidden: boolean;
}
