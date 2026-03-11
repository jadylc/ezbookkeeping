package api

import (
	"sort"
	"strings"
	"time"

	"github.com/mayswind/ezbookkeeping/pkg/core"
	"github.com/mayswind/ezbookkeeping/pkg/duplicatechecker"
	"github.com/mayswind/ezbookkeeping/pkg/errs"
	"github.com/mayswind/ezbookkeeping/pkg/log"
	"github.com/mayswind/ezbookkeeping/pkg/models"
	"github.com/mayswind/ezbookkeeping/pkg/services"
	"github.com/mayswind/ezbookkeeping/pkg/settings"
	"github.com/mayswind/ezbookkeeping/pkg/utils"
	"github.com/mayswind/ezbookkeeping/pkg/validators"
)

// AccountsApi represents account api
type AccountsApi struct {
	ApiUsingConfig
	ApiUsingDuplicateChecker
	accounts     *services.AccountService
	accountTags  *services.AccountTagService
	transactions *services.TransactionService
}

// Initialize an account api singleton instance
var (
	Accounts = &AccountsApi{
		ApiUsingConfig: ApiUsingConfig{
			container: settings.Container,
		},
		ApiUsingDuplicateChecker: ApiUsingDuplicateChecker{
			ApiUsingConfig: ApiUsingConfig{
				container: settings.Container,
			},
			container: duplicatechecker.Container,
		},
		accounts:     services.Accounts,
		accountTags:  services.AccountTags,
		transactions: services.Transactions,
	}
)

// AccountListHandler returns accounts list of current user
func (a *AccountsApi) AccountListHandler(c *core.WebContext) (any, *errs.Error) {
	var accountListReq models.AccountListRequest
	err := c.ShouldBindQuery(&accountListReq)

	if err != nil {
		log.Warnf(c, "[accounts.AccountListHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	uid := c.GetCurrentUid()
	accounts, err := a.accounts.GetAllAccountsByUid(c, uid)

	if err != nil {
		log.Errorf(c, "[accounts.AccountListHandler] failed to get all accounts for user \"uid:%d\", because %s", uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	userFinalAccountResps := make(models.AccountInfoResponseSlice, 0, len(accounts))

	for i := 0; i < len(accounts); i++ {
		account := accounts[i]

		if account.Type == models.ACCOUNT_TYPE_MULTI_SUB_ACCOUNTS {
			continue
		}

		accountResp := account.ToAccountInfoResponse()
		accountResp.ParentId = models.LevelOneAccountParentId
		accountResp.Type = models.ACCOUNT_TYPE_SINGLE_ACCOUNT
		accountResp.SubAccounts = nil

		if accountListReq.VisibleOnly && accountResp.Hidden {
			continue
		}

		userFinalAccountResps = append(userFinalAccountResps, accountResp)
	}

	sort.Sort(userFinalAccountResps)

	return userFinalAccountResps, nil
}

// AccountGetHandler returns one specific account of current user
func (a *AccountsApi) AccountGetHandler(c *core.WebContext) (any, *errs.Error) {
	var accountGetReq models.AccountGetRequest
	err := c.ShouldBindQuery(&accountGetReq)

	if err != nil {
		log.Warnf(c, "[accounts.AccountGetHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	uid := c.GetCurrentUid()
	accountAndSubAccounts, err := a.accounts.GetAccountAndSubAccountsByAccountId(c, uid, accountGetReq.Id)

	if err != nil {
		log.Errorf(c, "[accounts.AccountGetHandler] failed to get account \"id:%d\" for user \"uid:%d\", because %s", accountGetReq.Id, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	accountRespMap := make(map[int64]*models.AccountInfoResponse)

	for i := 0; i < len(accountAndSubAccounts); i++ {
		accountResp := accountAndSubAccounts[i].ToAccountInfoResponse()
		accountRespMap[accountResp.Id] = accountResp
	}

	accountResp, exists := accountRespMap[accountGetReq.Id]

	if !exists {
		return nil, errs.ErrAccountNotFound
	}

	accountResp.ParentId = models.LevelOneAccountParentId
	accountResp.Type = models.ACCOUNT_TYPE_SINGLE_ACCOUNT
	accountResp.SubAccounts = nil

	return accountResp, nil
}

// AccountCreateHandler saves a new account by request parameters for current user
func (a *AccountsApi) AccountCreateHandler(c *core.WebContext) (any, *errs.Error) {
	var accountCreateReq models.AccountCreateRequest
	err := c.ShouldBindJSON(&accountCreateReq)

	if err != nil {
		log.Warnf(c, "[accounts.AccountCreateHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	clientTimezone, err := c.GetClientTimezone()

	if err != nil {
		log.Warnf(c, "[accounts.AccountCreateHandler] cannot get client timezone, because %s", err.Error())
		return nil, errs.ErrClientTimezoneOffsetInvalid
	}

	if accountCreateReq.Category < models.ACCOUNT_CATEGORY_CASH || accountCreateReq.Category > models.ACCOUNT_CATEGORY_CERTIFICATE_OF_DEPOSIT {
		log.Warnf(c, "[accounts.AccountCreateHandler] account category invalid, category is %d", accountCreateReq.Category)
		return nil, errs.ErrAccountCategoryInvalid
	}

	if accountCreateReq.Category != models.ACCOUNT_CATEGORY_CREDIT_CARD && accountCreateReq.CreditCardStatementDate != 0 {
		log.Warnf(c, "[accounts.AccountCreateHandler] cannot set statement date with category \"%d\"", accountCreateReq.Category)
		return nil, errs.ErrCannotSetStatementDateForNonCreditCard
	}

	if len(accountCreateReq.SubAccounts) > 0 {
		log.Warnf(c, "[accounts.AccountCreateHandler] account cannot have any sub-accounts")
		return nil, errs.ErrAccountCannotHaveSubAccounts
	}

	if accountCreateReq.Currency == validators.ParentAccountCurrencyPlaceholder {
		log.Warnf(c, "[accounts.AccountCreateHandler] account cannot set currency placeholder")
		return nil, errs.ErrAccountCurrencyInvalid
	}

	if accountCreateReq.Balance != 0 && accountCreateReq.BalanceTime <= 0 {
		log.Warnf(c, "[accounts.AccountCreateHandler] account balance time is not set")
		return nil, errs.ErrAccountBalanceTimeNotSet
	}

	accountCreateReq.Type = models.ACCOUNT_TYPE_SINGLE_ACCOUNT

	uid := c.GetCurrentUid()
	normalizedTags, errObj := a.normalizeAccountTagNames(c, uid, accountCreateReq.Tags, accountCreateReq.Tag)

	if errObj != nil {
		return nil, errObj
	}

	accountCreateReq.Tags = normalizedTags
	accountCreateReq.Tag = ""
	maxOrderId, err := a.accounts.GetMaxDisplayOrder(c, uid, accountCreateReq.Category)

	if err != nil {
		log.Errorf(c, "[accounts.AccountCreateHandler] failed to get max display order for user \"uid:%d\", because %s", uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	mainAccount := a.createNewAccountModel(uid, &accountCreateReq, false, maxOrderId+1)
	childrenAccounts, childrenAccountBalanceTimes := a.createSubAccountModels(uid, &accountCreateReq)

	if a.CurrentConfig().EnableDuplicateSubmissionsCheck && accountCreateReq.ClientSessionId != "" {
		found, remark := a.GetSubmissionRemark(duplicatechecker.DUPLICATE_CHECKER_TYPE_NEW_ACCOUNT, uid, accountCreateReq.ClientSessionId)

		if found {
			log.Infof(c, "[accounts.AccountCreateHandler] another account \"id:%s\" has been created for user \"uid:%d\"", remark, uid)
			accountId, err := utils.StringToInt64(remark)

			if err == nil {
				accountAndSubAccounts, err := a.accounts.GetAccountAndSubAccountsByAccountId(c, uid, accountId)

				if err != nil {
					log.Errorf(c, "[accounts.AccountCreateHandler] failed to get existed account \"id:%d\" for user \"uid:%d\", because %s", accountId, uid, err.Error())
					return nil, errs.Or(err, errs.ErrOperationFailed)
				}

				accountMap := a.accounts.GetAccountMapByList(accountAndSubAccounts)
				mainAccount, exists := accountMap[accountId]

				if !exists {
					return nil, errs.ErrOperationFailed
				}

				accountInfoResp := mainAccount.ToAccountInfoResponse()
				accountInfoResp.ParentId = models.LevelOneAccountParentId
				accountInfoResp.Type = models.ACCOUNT_TYPE_SINGLE_ACCOUNT
				accountInfoResp.SubAccounts = nil

				return accountInfoResp, nil
			}
		}
	}

	err = a.accounts.CreateAccounts(c, mainAccount, accountCreateReq.BalanceTime, childrenAccounts, childrenAccountBalanceTimes, clientTimezone)

	if err != nil {
		log.Errorf(c, "[accounts.AccountCreateHandler] failed to create account \"id:%d\" for user \"uid:%d\", because %s", mainAccount.AccountId, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	log.Infof(c, "[accounts.AccountCreateHandler] user \"uid:%d\" has created a new account \"id:%d\" successfully", uid, mainAccount.AccountId)

	a.SetSubmissionRemarkIfEnable(duplicatechecker.DUPLICATE_CHECKER_TYPE_NEW_ACCOUNT, uid, accountCreateReq.ClientSessionId, utils.Int64ToString(mainAccount.AccountId))
	accountInfoResp := mainAccount.ToAccountInfoResponse()
	accountInfoResp.ParentId = models.LevelOneAccountParentId
	accountInfoResp.Type = models.ACCOUNT_TYPE_SINGLE_ACCOUNT
	accountInfoResp.SubAccounts = nil

	return accountInfoResp, nil
}

// AccountModifyHandler saves an existed account by request parameters for current user
func (a *AccountsApi) AccountModifyHandler(c *core.WebContext) (any, *errs.Error) {
	var accountModifyReq models.AccountModifyRequest
	err := c.ShouldBindJSON(&accountModifyReq)

	if err != nil {
		log.Warnf(c, "[accounts.AccountModifyHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	if accountModifyReq.Id <= 0 {
		return nil, errs.ErrAccountIdInvalid
	}

	clientTimezone, err := c.GetClientTimezone()

	if err != nil {
		log.Warnf(c, "[accounts.AccountModifyHandler] cannot get client timezone, because %s", err.Error())
		return nil, errs.ErrClientTimezoneOffsetInvalid
	}

	if accountModifyReq.Category < models.ACCOUNT_CATEGORY_CASH || accountModifyReq.Category > models.ACCOUNT_CATEGORY_CERTIFICATE_OF_DEPOSIT {
		log.Warnf(c, "[accounts.AccountModifyHandler] account category invalid, category is %d", accountModifyReq.Category)
		return nil, errs.ErrAccountCategoryInvalid
	}

	if accountModifyReq.Category != models.ACCOUNT_CATEGORY_CREDIT_CARD && accountModifyReq.CreditCardStatementDate != 0 {
		log.Warnf(c, "[accounts.AccountModifyHandler] cannot set statement date with category \"%d\"", accountModifyReq.Category)
		return nil, errs.ErrCannotSetStatementDateForNonCreditCard
	}

	uid := c.GetCurrentUid()
	accountAndSubAccounts, err := a.accounts.GetAccountAndSubAccountsByAccountId(c, uid, accountModifyReq.Id)

	if err != nil {
		log.Errorf(c, "[accounts.AccountModifyHandler] failed to get account \"id:%d\" for user \"uid:%d\", because %s", accountModifyReq.Id, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	accountMap := a.accounts.GetAccountMapByList(accountAndSubAccounts)
	mainAccount, exists := accountMap[accountModifyReq.Id]

	if !exists {
		return nil, errs.ErrAccountNotFound
	}

	if accountModifyReq.Currency != nil && *accountModifyReq.Currency == validators.ParentAccountCurrencyPlaceholder {
		log.Warnf(c, "[accounts.AccountModifyHandler] account cannot set currency placeholder")
		return nil, errs.ErrAccountCurrencyInvalid
	}

	if accountModifyReq.BalanceTime != nil {
		return nil, errs.ErrNotSupportedChangeBalanceTime
	}

	if len(accountModifyReq.SubAccounts) > 0 {
		log.Warnf(c, "[accounts.AccountModifyHandler] account cannot have any sub-accounts")
		return nil, errs.ErrAccountCannotHaveSubAccounts
	}

	normalizedTags, errObj := a.normalizeAccountTagNames(c, uid, accountModifyReq.Tags, accountModifyReq.Tag)

	if errObj != nil {
		return nil, errObj
	}

	accountModifyReq.Tags = normalizedTags
	accountModifyReq.Tag = ""

	balanceChanged := accountModifyReq.Balance != nil && mainAccount.Balance != *accountModifyReq.Balance
	var balanceTransaction *models.Transaction

	if balanceChanged {
		sess := a.transactions.UserDataDB(uid).NewSession(c)
		otherTransactionExists, err := sess.Cols("uid", "deleted", "account_id").Where("uid=? AND deleted=? AND account_id=? AND type<>?", uid, false, mainAccount.AccountId, models.TRANSACTION_DB_TYPE_MODIFY_BALANCE).Limit(1).Exist(&models.Transaction{})

		if err != nil {
			log.Errorf(c, "[accounts.AccountModifyHandler] failed to get whether other transactions exist for account \"id:%d\" user \"uid:%d\", because %s", mainAccount.AccountId, uid, err.Error())
			return nil, errs.Or(err, errs.ErrOperationFailed)
		} else if otherTransactionExists {
			return nil, errs.ErrBalanceModificationTransactionCannotAddWhenNotEmpty
		}

		var balanceTransactions []*models.Transaction
		err = sess.Where("uid=? AND deleted=? AND account_id=? AND type=?", uid, false, mainAccount.AccountId, models.TRANSACTION_DB_TYPE_MODIFY_BALANCE).Find(&balanceTransactions)

		if err != nil {
			log.Errorf(c, "[accounts.AccountModifyHandler] failed to get balance modification transaction for account \"id:%d\" user \"uid:%d\", because %s", mainAccount.AccountId, uid, err.Error())
			return nil, errs.Or(err, errs.ErrOperationFailed)
		} else if len(balanceTransactions) > 1 {
			log.Errorf(c, "[accounts.AccountModifyHandler] found %d balance modification transactions for account \"id:%d\" user \"uid:%d\"", len(balanceTransactions), mainAccount.AccountId, uid)
			return nil, errs.ErrDatabaseOperationFailed
		} else if len(balanceTransactions) == 1 {
			balanceTransaction = balanceTransactions[0]
		}
	}

	anythingUpdate := balanceChanged
	var toUpdateAccounts []*models.Account
	var toAddAccounts []*models.Account
	var toAddAccountBalanceTimes []int64
	var toDeleteAccountIds []int64

	toUpdateAccount := a.getToUpdateAccount(uid, &accountModifyReq, mainAccount, false)

	if toUpdateAccount != nil {
		if toUpdateAccount.Category != mainAccount.Category {
			maxOrderId, err := a.accounts.GetMaxDisplayOrder(c, uid, toUpdateAccount.Category)

			if err != nil {
				log.Errorf(c, "[accounts.AccountModifyHandler] failed to get max display order for user \"uid:%d\", because %s", uid, err.Error())
				return nil, errs.Or(err, errs.ErrOperationFailed)
			}

			toUpdateAccount.DisplayOrder = maxOrderId + 1
		}

		anythingUpdate = true
		toUpdateAccounts = append(toUpdateAccounts, toUpdateAccount)
	}

	toDeleteAccountIds = nil

	if !anythingUpdate {
		return nil, errs.ErrNothingWillBeUpdated
	}

	if balanceChanged {
		if balanceTransaction != nil {
			transactionToUpdate := &models.Transaction{
				TransactionId:        balanceTransaction.TransactionId,
				Uid:                  uid,
				Type:                 balanceTransaction.Type,
				CategoryId:           balanceTransaction.CategoryId,
				TransactionTime:      balanceTransaction.TransactionTime,
				TimezoneUtcOffset:    balanceTransaction.TimezoneUtcOffset,
				AccountId:            balanceTransaction.AccountId,
				Amount:               *accountModifyReq.Balance,
				RelatedAccountId:     balanceTransaction.RelatedAccountId,
				RelatedAccountAmount: balanceTransaction.RelatedAccountAmount,
				HideAmount:           balanceTransaction.HideAmount,
				Comment:              balanceTransaction.Comment,
				GeoLongitude:         balanceTransaction.GeoLongitude,
				GeoLatitude:          balanceTransaction.GeoLatitude,
			}

			err = a.transactions.ModifyTransaction(c, transactionToUpdate, 0, nil, nil, nil, nil)

			if err != nil {
				log.Errorf(c, "[accounts.AccountModifyHandler] failed to update balance modification transaction for account \"id:%d\" user \"uid:%d\", because %s", mainAccount.AccountId, uid, err.Error())
				return nil, errs.Or(err, errs.ErrOperationFailed)
			}
		} else {
			now := time.Now().Unix()
			transactionTime := utils.GetMinTransactionTimeFromUnixTime(now)
			transactionUtcOffset := utils.GetTimezoneOffsetMinutes(now, clientTimezone)

			newTransaction := &models.Transaction{
				Uid:               uid,
				Deleted:           false,
				Type:              models.TRANSACTION_DB_TYPE_MODIFY_BALANCE,
				TransactionTime:   transactionTime,
				TimezoneUtcOffset: transactionUtcOffset,
				AccountId:         mainAccount.AccountId,
				Amount:            *accountModifyReq.Balance,
				RelatedAccountId:  mainAccount.AccountId,
			}

			err = a.transactions.CreateTransaction(c, newTransaction, nil, nil)

			if err != nil {
				log.Errorf(c, "[accounts.AccountModifyHandler] failed to create balance modification transaction for account \"id:%d\" user \"uid:%d\", because %s", mainAccount.AccountId, uid, err.Error())
				return nil, errs.Or(err, errs.ErrOperationFailed)
			}
		}

		mainAccount.Balance = *accountModifyReq.Balance
	}

	if len(toAddAccounts) > 0 && a.CurrentConfig().EnableDuplicateSubmissionsCheck && accountModifyReq.ClientSessionId != "" {
		found, remark := a.GetSubmissionRemark(duplicatechecker.DUPLICATE_CHECKER_TYPE_NEW_SUBACCOUNT, uid, accountModifyReq.ClientSessionId)

		if found {
			log.Infof(c, "[accounts.AccountModifyHandler] another account \"id:%s\" modification has been created for user \"uid:%d\"", remark, uid)
			accountId, err := utils.StringToInt64(remark)

			if err == nil {
				accountAndSubAccounts, err := a.accounts.GetAccountAndSubAccountsByAccountId(c, uid, accountId)

				if err != nil {
					log.Errorf(c, "[accounts.AccountModifyHandler] failed to get existed account \"id:%d\" for user \"uid:%d\", because %s", accountId, uid, err.Error())
					return nil, errs.Or(err, errs.ErrOperationFailed)
				}

				accountMap := a.accounts.GetAccountMapByList(accountAndSubAccounts)
				mainAccount, exists := accountMap[accountId]

				if !exists {
					return nil, errs.ErrOperationFailed
				}

				accountInfoResp := mainAccount.ToAccountInfoResponse()
				accountInfoResp.ParentId = models.LevelOneAccountParentId
				accountInfoResp.Type = models.ACCOUNT_TYPE_SINGLE_ACCOUNT
				accountInfoResp.SubAccounts = nil

				return accountInfoResp, nil
			}
		}
	}

	err = a.accounts.ModifyAccounts(c, mainAccount, toUpdateAccounts, toAddAccounts, toAddAccountBalanceTimes, toDeleteAccountIds, clientTimezone)

	if err != nil {
		log.Errorf(c, "[accounts.AccountModifyHandler] failed to update account \"id:%d\" for user \"uid:%d\", because %s", accountModifyReq.Id, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	log.Infof(c, "[accounts.AccountModifyHandler] user \"uid:%d\" has updated account \"id:%d\" successfully", uid, accountModifyReq.Id)

	if accountModifyReq.Currency != nil {
		mainAccount.Currency = *accountModifyReq.Currency
	}

	if len(toAddAccounts) > 0 {
		a.SetSubmissionRemarkIfEnable(duplicatechecker.DUPLICATE_CHECKER_TYPE_NEW_SUBACCOUNT, uid, accountModifyReq.ClientSessionId, utils.Int64ToString(mainAccount.AccountId))
	}

	accountRespMap := make(map[int64]*models.AccountInfoResponse)

	for i := 0; i < len(toUpdateAccounts); i++ {
		account := toUpdateAccounts[i]
		oldAccount := accountMap[account.AccountId]

		account.Type = oldAccount.Type
		account.ParentAccountId = oldAccount.ParentAccountId
		account.Currency = oldAccount.Currency
		account.Balance = oldAccount.Balance

		accountResp := account.ToAccountInfoResponse()
		accountRespMap[accountResp.Id] = accountResp
	}

	for i := 0; i < len(toAddAccounts); i++ {
		account := toAddAccounts[i]
		accountResp := account.ToAccountInfoResponse()
		accountRespMap[accountResp.Id] = accountResp
	}

	deletedAccountIds := make(map[int64]bool)

	for i := 0; i < len(toDeleteAccountIds); i++ {
		deletedAccountIds[toDeleteAccountIds[i]] = true
	}

	for i := 0; i < len(accountAndSubAccounts); i++ {
		oldAccount := accountAndSubAccounts[i]
		_, exists := accountRespMap[oldAccount.AccountId]

		if !exists && !deletedAccountIds[oldAccount.AccountId] {
			oldAccountResp := oldAccount.ToAccountInfoResponse()
			accountRespMap[oldAccountResp.Id] = oldAccountResp
		}
	}

	accountResp := accountRespMap[accountModifyReq.Id]
	accountResp.ParentId = models.LevelOneAccountParentId
	accountResp.Type = models.ACCOUNT_TYPE_SINGLE_ACCOUNT
	accountResp.SubAccounts = nil

	return accountResp, nil
}

// AccountHideHandler hides an existed account by request parameters for current user
func (a *AccountsApi) AccountHideHandler(c *core.WebContext) (any, *errs.Error) {
	var accountHideReq models.AccountHideRequest
	err := c.ShouldBindJSON(&accountHideReq)

	if err != nil {
		log.Warnf(c, "[accounts.AccountHideHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	uid := c.GetCurrentUid()
	err = a.accounts.HideAccount(c, uid, []int64{accountHideReq.Id}, accountHideReq.Hidden)

	if err != nil {
		log.Errorf(c, "[accounts.AccountHideHandler] failed to hide account \"id:%d\" for user \"uid:%d\", because %s", accountHideReq.Id, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	log.Infof(c, "[accounts.AccountHideHandler] user \"uid:%d\" has hidden account \"id:%d\"", uid, accountHideReq.Id)
	return true, nil
}

// AccountMoveHandler moves display order of existed accounts by request parameters for current user
func (a *AccountsApi) AccountMoveHandler(c *core.WebContext) (any, *errs.Error) {
	var accountMoveReq models.AccountMoveRequest
	err := c.ShouldBindJSON(&accountMoveReq)

	if err != nil {
		log.Warnf(c, "[accounts.AccountMoveHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	uid := c.GetCurrentUid()
	accounts := make([]*models.Account, len(accountMoveReq.NewDisplayOrders))

	for i := 0; i < len(accountMoveReq.NewDisplayOrders); i++ {
		newDisplayOrder := accountMoveReq.NewDisplayOrders[i]
		account := &models.Account{
			Uid:          uid,
			AccountId:    newDisplayOrder.Id,
			DisplayOrder: newDisplayOrder.DisplayOrder,
		}

		accounts[i] = account
	}

	err = a.accounts.ModifyAccountDisplayOrders(c, uid, accounts)

	if err != nil {
		log.Errorf(c, "[accounts.AccountMoveHandler] failed to move accounts for user \"uid:%d\", because %s", uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	log.Infof(c, "[accounts.AccountMoveHandler] user \"uid:%d\" has moved accounts", uid)
	return true, nil
}

// AccountDeleteHandler deletes an existed account by request parameters for current user
func (a *AccountsApi) AccountDeleteHandler(c *core.WebContext) (any, *errs.Error) {
	var accountDeleteReq models.AccountDeleteRequest
	err := c.ShouldBindJSON(&accountDeleteReq)

	if err != nil {
		log.Warnf(c, "[accounts.AccountDeleteHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	uid := c.GetCurrentUid()
	err = a.accounts.DeleteAccount(c, uid, accountDeleteReq.Id)

	if err != nil {
		log.Errorf(c, "[accounts.AccountDeleteHandler] failed to delete account \"id:%d\" for user \"uid:%d\", because %s", accountDeleteReq.Id, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	log.Infof(c, "[accounts.AccountDeleteHandler] user \"uid:%d\" has deleted account \"id:%d\"", uid, accountDeleteReq.Id)
	return true, nil
}

// SubAccountDeleteHandler deletes an existed account by request parameters for current user
func (a *AccountsApi) SubAccountDeleteHandler(c *core.WebContext) (any, *errs.Error) {
	var accountDeleteReq models.AccountDeleteRequest
	err := c.ShouldBindJSON(&accountDeleteReq)

	if err != nil {
		log.Warnf(c, "[accounts.SubAccountDeleteHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	uid := c.GetCurrentUid()
	err = a.accounts.DeleteSubAccount(c, uid, accountDeleteReq.Id)

	if err != nil {
		log.Errorf(c, "[accounts.SubAccountDeleteHandler] failed to delete account \"id:%d\" for user \"uid:%d\", because %s", accountDeleteReq.Id, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	log.Infof(c, "[accounts.SubAccountDeleteHandler] user \"uid:%d\" has deleted account \"id:%d\"", uid, accountDeleteReq.Id)
	return true, nil
}

func (a *AccountsApi) createNewAccountModel(uid int64, accountCreateReq *models.AccountCreateRequest, isSubAccount bool, order int32) *models.Account {
	accountExtend := &models.AccountExtend{}

	if !isSubAccount && accountCreateReq.Category == models.ACCOUNT_CATEGORY_CREDIT_CARD {
		accountExtend.CreditCardStatementDate = &accountCreateReq.CreditCardStatementDate
	}

	accountExtend.Tags = accountCreateReq.Tags

	return &models.Account{
		Uid:          uid,
		Name:         accountCreateReq.Name,
		DisplayOrder: order,
		Category:     accountCreateReq.Category,
		Type:         accountCreateReq.Type,
		Icon:         accountCreateReq.Icon,
		Color:        accountCreateReq.Color,
		Currency:     accountCreateReq.Currency,
		Balance:      accountCreateReq.Balance,
		Comment:      accountCreateReq.Comment,
		Extend:       accountExtend,
	}
}

func (a *AccountsApi) createNewSubAccountModelForModify(uid int64, accountType models.AccountType, accountModifyReq *models.AccountModifyRequest, order int32) *models.Account {
	accountExtend := &models.AccountExtend{}

	return &models.Account{
		Uid:          uid,
		Name:         accountModifyReq.Name,
		DisplayOrder: order,
		Category:     accountModifyReq.Category,
		Type:         accountType,
		Icon:         accountModifyReq.Icon,
		Color:        accountModifyReq.Color,
		Currency:     *accountModifyReq.Currency,
		Balance:      *accountModifyReq.Balance,
		Comment:      accountModifyReq.Comment,
		Extend:       accountExtend,
	}
}

func (a *AccountsApi) createSubAccountModels(uid int64, accountCreateReq *models.AccountCreateRequest) ([]*models.Account, []int64) {
	if len(accountCreateReq.SubAccounts) <= 0 {
		return nil, nil
	}

	childrenAccounts := make([]*models.Account, len(accountCreateReq.SubAccounts))
	childrenAccountBalanceTimes := make([]int64, len(accountCreateReq.SubAccounts))

	for i := int32(0); i < int32(len(accountCreateReq.SubAccounts)); i++ {
		childrenAccounts[i] = a.createNewAccountModel(uid, accountCreateReq.SubAccounts[i], true, i+1)
		childrenAccountBalanceTimes[i] = accountCreateReq.SubAccounts[i].BalanceTime
	}

	return childrenAccounts, childrenAccountBalanceTimes
}

func (a *AccountsApi) getToUpdateAccount(uid int64, accountModifyReq *models.AccountModifyRequest, oldAccount *models.Account, isSubAccount bool) *models.Account {
	newAccountExtend := &models.AccountExtend{}

	if !isSubAccount && accountModifyReq.Category == models.ACCOUNT_CATEGORY_CREDIT_CARD {
		newAccountExtend.CreditCardStatementDate = &accountModifyReq.CreditCardStatementDate
	}

	newAccountExtend.Tags = accountModifyReq.Tags

	newAccount := &models.Account{
		AccountId:    oldAccount.AccountId,
		Uid:          uid,
		Name:         accountModifyReq.Name,
		DisplayOrder: oldAccount.DisplayOrder,
		Category:     accountModifyReq.Category,
		Icon:         accountModifyReq.Icon,
		Color:        accountModifyReq.Color,
		Currency:     oldAccount.Currency,
		Comment:      accountModifyReq.Comment,
		Extend:       newAccountExtend,
		Hidden:       accountModifyReq.Hidden,
	}

	if accountModifyReq.Currency != nil {
		newAccount.Currency = *accountModifyReq.Currency
	}

	oldAccountTags := a.getAccountTagNamesFromExtend(oldAccount.Extend)

	if newAccount.Name != oldAccount.Name ||
		newAccount.Category != oldAccount.Category ||
		newAccount.Icon != oldAccount.Icon ||
		newAccount.Color != oldAccount.Color ||
		newAccount.Currency != oldAccount.Currency ||
		newAccount.Comment != oldAccount.Comment ||
		!a.isSameStringSlice(newAccount.Extend.Tags, oldAccountTags) ||
		newAccount.Hidden != oldAccount.Hidden {
		return newAccount
	}

	if (newAccount.Extend != nil && oldAccount.Extend == nil) ||
		(newAccount.Extend == nil && oldAccount.Extend != nil) {
		return newAccount
	}

	oldAccountExtend := oldAccount.Extend

	if oldAccountExtend == nil {
		oldAccountExtend = &models.AccountExtend{}
	}

	if newAccountExtend.CreditCardStatementDate != oldAccountExtend.CreditCardStatementDate {
		return newAccount
	}

	oldAccountExtendTags := a.getAccountTagNamesFromExtend(oldAccountExtend)

	if !a.isSameStringSlice(newAccountExtend.Tags, oldAccountExtendTags) {
		return newAccount
	}

	return nil
}

func (a *AccountsApi) normalizeAccountTagNames(c *core.WebContext, uid int64, tagNames []string, legacyTag string) ([]string, *errs.Error) {
	finalTagNames := make([]string, 0, len(tagNames)+1)
	tagNameMap := make(map[string]bool)

	mergedTagNames := make([]string, 0, len(tagNames)+1)
	mergedTagNames = append(mergedTagNames, tagNames...)

	if strings.TrimSpace(legacyTag) != "" {
		mergedTagNames = append(mergedTagNames, legacyTag)
	}

	for _, rawTagName := range mergedTagNames {
		tagName := strings.TrimSpace(rawTagName)

		if tagName == "" || tagNameMap[tagName] {
			continue
		}

		tag, err := a.accountTags.GetTagByTagName(c, uid, tagName)

		if err != nil {
			log.Errorf(c, "[accounts.normalizeAccountTagNames] failed to get account tag \"%s\" for user \"uid:%d\", because %s", tagName, uid, err.Error())
			return nil, errs.Or(err, errs.ErrOperationFailed)
		} else if tag == nil {
			log.Warnf(c, "[accounts.normalizeAccountTagNames] account tag \"%s\" not found", tagName)
			return nil, errs.ErrAccountTagNotFound
		} else if tag.Hidden {
			log.Warnf(c, "[accounts.normalizeAccountTagNames] account tag \"%s\" is hidden", tagName)
			return nil, errs.ErrCannotUseHiddenAccountTag
		}

		tagNameMap[tag.Name] = true
		finalTagNames = append(finalTagNames, tag.Name)
	}

	return finalTagNames, nil
}

func (a *AccountsApi) getAccountTagNamesFromExtend(extend *models.AccountExtend) []string {
	if extend == nil {
		return nil
	}

	if len(extend.Tags) > 0 {
		return extend.Tags
	}

	if extend.Tag != "" {
		return []string{extend.Tag}
	}

	return nil
}

func (a *AccountsApi) isSameStringSlice(left []string, right []string) bool {
	if len(left) == 0 && len(right) == 0 {
		return true
	}

	if len(left) != len(right) {
		return false
	}

	for i := 0; i < len(left); i++ {
		if left[i] != right[i] {
			return false
		}
	}

	return true
}

func (a *AccountsApi) getToDeleteSubAccountIds(accountModifyReq *models.AccountModifyRequest, mainAccount *models.Account, accountAndSubAccounts []*models.Account) []int64 {
	newSubAccountIds := make(map[int64]bool, len(accountModifyReq.SubAccounts))

	for i := 0; i < len(accountModifyReq.SubAccounts); i++ {
		newSubAccountIds[accountModifyReq.SubAccounts[i].Id] = true
	}

	toDeleteAccountIds := make([]int64, 0)

	for i := 0; i < len(accountAndSubAccounts); i++ {
		subAccount := accountAndSubAccounts[i]

		if subAccount.AccountId == mainAccount.AccountId {
			continue
		}

		if _, exists := newSubAccountIds[subAccount.AccountId]; !exists {
			toDeleteAccountIds = append(toDeleteAccountIds, subAccount.AccountId)
		}
	}

	return toDeleteAccountIds
}
