package api

import (
	"sort"

	"github.com/mayswind/ezbookkeeping/pkg/core"
	"github.com/mayswind/ezbookkeeping/pkg/errs"
	"github.com/mayswind/ezbookkeeping/pkg/log"
	"github.com/mayswind/ezbookkeeping/pkg/models"
	"github.com/mayswind/ezbookkeeping/pkg/services"
)

// AccountTagsApi represents account tag api
type AccountTagsApi struct {
	tags *services.AccountTagService
}

// Initialize an account tag api singleton instance
var (
	AccountTags = &AccountTagsApi{
		tags: services.AccountTags,
	}
)

// TagListHandler returns account tag list of current user
func (a *AccountTagsApi) TagListHandler(c *core.WebContext) (any, *errs.Error) {
	uid := c.GetCurrentUid()

	tags, err := a.tags.GetAllTagsByUid(c, uid)

	if err != nil {
		log.Errorf(c, "[account_tags.TagListHandler] failed to get tags for user \"uid:%d\", because %s", uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	tagResps := make(models.AccountTagInfoResponseSlice, len(tags))

	for i := 0; i < len(tags); i++ {
		tagResps[i] = tags[i].ToAccountTagInfoResponse()
	}

	sort.Sort(tagResps)

	return tagResps, nil
}

// TagGetHandler returns one specific account tag of current user
func (a *AccountTagsApi) TagGetHandler(c *core.WebContext) (any, *errs.Error) {
	var tagGetReq models.AccountTagGetRequest
	err := c.ShouldBindQuery(&tagGetReq)

	if err != nil {
		log.Warnf(c, "[account_tags.TagGetHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	uid := c.GetCurrentUid()
	tag, err := a.tags.GetTagByTagId(c, uid, tagGetReq.Id)

	if err != nil {
		log.Errorf(c, "[account_tags.TagGetHandler] failed to get tag \"id:%d\" for user \"uid:%d\", because %s", tagGetReq.Id, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	tagResp := tag.ToAccountTagInfoResponse()
	return tagResp, nil
}

// TagCreateHandler saves a new account tag by request parameters for current user
func (a *AccountTagsApi) TagCreateHandler(c *core.WebContext) (any, *errs.Error) {
	var tagCreateReq models.AccountTagCreateRequest
	err := c.ShouldBindJSON(&tagCreateReq)

	if err != nil {
		log.Warnf(c, "[account_tags.TagCreateHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	uid := c.GetCurrentUid()
	maxOrderId, err := a.tags.GetMaxDisplayOrder(c, uid)

	if err != nil {
		log.Errorf(c, "[account_tags.TagCreateHandler] failed to get max display order for user \"uid:%d\", because %s", uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	tag := &models.AccountTag{
		Uid:          uid,
		Name:         tagCreateReq.Name,
		DisplayOrder: maxOrderId + 1,
	}

	err = a.tags.CreateTag(c, tag)

	if err != nil {
		log.Errorf(c, "[account_tags.TagCreateHandler] failed to create tag \"id:%d\" for user \"uid:%d\", because %s", tag.TagId, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	log.Infof(c, "[account_tags.TagCreateHandler] user \"uid:%d\" has created a new tag \"id:%d\" successfully", uid, tag.TagId)

	tagResp := tag.ToAccountTagInfoResponse()
	return tagResp, nil
}

// TagModifyHandler saves an existed account tag by request parameters for current user
func (a *AccountTagsApi) TagModifyHandler(c *core.WebContext) (any, *errs.Error) {
	var tagModifyReq models.AccountTagModifyRequest
	err := c.ShouldBindJSON(&tagModifyReq)

	if err != nil {
		log.Warnf(c, "[account_tags.TagModifyHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	uid := c.GetCurrentUid()
	tag, err := a.tags.GetTagByTagId(c, uid, tagModifyReq.Id)

	if err != nil {
		log.Errorf(c, "[account_tags.TagModifyHandler] failed to get tag \"id:%d\" for user \"uid:%d\", because %s", tagModifyReq.Id, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	newTag := &models.AccountTag{
		TagId:        tag.TagId,
		Uid:          uid,
		Name:         tagModifyReq.Name,
		DisplayOrder: tag.DisplayOrder,
		Hidden:       tag.Hidden,
	}

	oldTagName := tag.Name
	if oldTagName == newTag.Name {
		return tag.ToAccountTagInfoResponse(), nil
	}

	err = a.tags.ModifyTag(c, newTag, oldTagName)

	if err != nil {
		log.Errorf(c, "[account_tags.TagModifyHandler] failed to update tag \"id:%d\" for user \"uid:%d\", because %s", tagModifyReq.Id, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	log.Infof(c, "[account_tags.TagModifyHandler] user \"uid:%d\" has updated tag \"id:%d\" successfully", uid, tagModifyReq.Id)

	tag.Name = newTag.Name
	tagResp := tag.ToAccountTagInfoResponse()
	return tagResp, nil
}

// TagHideHandler hides an account tag by request parameters for current user
func (a *AccountTagsApi) TagHideHandler(c *core.WebContext) (any, *errs.Error) {
	var tagHideReq models.AccountTagHideRequest
	err := c.ShouldBindJSON(&tagHideReq)

	if err != nil {
		log.Warnf(c, "[account_tags.TagHideHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	uid := c.GetCurrentUid()
	err = a.tags.HideTag(c, uid, []int64{tagHideReq.Id}, tagHideReq.Hidden)

	if err != nil {
		log.Errorf(c, "[account_tags.TagHideHandler] failed to hide tag \"id:%d\" for user \"uid:%d\", because %s", tagHideReq.Id, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	log.Infof(c, "[account_tags.TagHideHandler] user \"uid:%d\" has hidden tag \"id:%d\"", uid, tagHideReq.Id)
	return true, nil
}

// TagMoveHandler moves display order of existed account tags by request parameters for current user
func (a *AccountTagsApi) TagMoveHandler(c *core.WebContext) (any, *errs.Error) {
	var tagMoveReq models.AccountTagMoveRequest
	err := c.ShouldBindJSON(&tagMoveReq)

	if err != nil {
		log.Warnf(c, "[account_tags.TagMoveHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	tags := make([]*models.AccountTag, len(tagMoveReq.NewDisplayOrders))
	uid := c.GetCurrentUid()

	for i := 0; i < len(tagMoveReq.NewDisplayOrders); i++ {
		newDisplayOrder := tagMoveReq.NewDisplayOrders[i]
		tag := &models.AccountTag{
			TagId:        newDisplayOrder.Id,
			Uid:          uid,
			DisplayOrder: newDisplayOrder.DisplayOrder,
		}
		tags[i] = tag
	}

	err = a.tags.ModifyTagDisplayOrders(c, uid, tags)

	if err != nil {
		log.Errorf(c, "[account_tags.TagMoveHandler] failed to move tags for user \"uid:%d\", because %s", uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	log.Infof(c, "[account_tags.TagMoveHandler] user \"uid:%d\" has moved tags", uid)
	return true, nil
}

// TagDeleteHandler deletes an existed account tag by request parameters for current user
func (a *AccountTagsApi) TagDeleteHandler(c *core.WebContext) (any, *errs.Error) {
	var tagDeleteReq models.AccountTagDeleteRequest
	err := c.ShouldBindJSON(&tagDeleteReq)

	if err != nil {
		log.Warnf(c, "[account_tags.TagDeleteHandler] parse request failed, because %s", err.Error())
		return nil, errs.NewIncompleteOrIncorrectSubmissionError(err)
	}

	uid := c.GetCurrentUid()
	err = a.tags.DeleteTag(c, uid, tagDeleteReq.Id)

	if err != nil {
		log.Errorf(c, "[account_tags.TagDeleteHandler] failed to delete tag \"id:%d\" for user \"uid:%d\", because %s", tagDeleteReq.Id, uid, err.Error())
		return nil, errs.Or(err, errs.ErrOperationFailed)
	}

	log.Infof(c, "[account_tags.TagDeleteHandler] user \"uid:%d\" has deleted tag \"id:%d\"", uid, tagDeleteReq.Id)
	return true, nil
}
