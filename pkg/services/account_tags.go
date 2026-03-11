package services

import (
	"strings"
	"time"

	"xorm.io/xorm"

	"github.com/mayswind/ezbookkeeping/pkg/core"
	"github.com/mayswind/ezbookkeeping/pkg/datastore"
	"github.com/mayswind/ezbookkeeping/pkg/errs"
	"github.com/mayswind/ezbookkeeping/pkg/models"
	"github.com/mayswind/ezbookkeeping/pkg/uuid"
)

// AccountTagService represents account tag service
type AccountTagService struct {
	ServiceUsingDB
	ServiceUsingUuid
}

// Initialize an account tag service singleton instance
var (
	AccountTags = &AccountTagService{
		ServiceUsingDB: ServiceUsingDB{
			container: datastore.Container,
		},
		ServiceUsingUuid: ServiceUsingUuid{
			container: uuid.Container,
		},
	}
)

// GetTotalTagCountByUid returns total account tag count of user
func (s *AccountTagService) GetTotalTagCountByUid(c core.Context, uid int64) (int64, error) {
	if uid <= 0 {
		return 0, errs.ErrUserIdInvalid
	}

	count, err := s.UserDataDB(uid).NewSession(c).Where("uid=? AND deleted=?", uid, false).Count(&models.AccountTag{})

	return count, err
}

// GetAllTagsByUid returns all account tag models of user
func (s *AccountTagService) GetAllTagsByUid(c core.Context, uid int64) ([]*models.AccountTag, error) {
	if uid <= 0 {
		return nil, errs.ErrUserIdInvalid
	}

	var tags []*models.AccountTag
	err := s.UserDataDB(uid).NewSession(c).Where("uid=? AND deleted=?", uid, false).Find(&tags)

	return tags, err
}

// GetTagByTagId returns an account tag model according to account tag id
func (s *AccountTagService) GetTagByTagId(c core.Context, uid int64, tagId int64) (*models.AccountTag, error) {
	if uid <= 0 {
		return nil, errs.ErrUserIdInvalid
	}

	if tagId <= 0 {
		return nil, errs.ErrAccountTagIdInvalid
	}

	tag := &models.AccountTag{}
	has, err := s.UserDataDB(uid).NewSession(c).ID(tagId).Where("uid=? AND deleted=?", uid, false).Get(tag)

	if err != nil {
		return nil, err
	} else if !has {
		return nil, errs.ErrAccountTagNotFound
	}

	return tag, nil
}

// GetTagByTagName returns an account tag model according to account tag name
func (s *AccountTagService) GetTagByTagName(c core.Context, uid int64, name string) (*models.AccountTag, error) {
	if uid <= 0 {
		return nil, errs.ErrUserIdInvalid
	}

	tagName := strings.TrimSpace(name)

	if len(tagName) < 1 {
		return nil, errs.ErrAccountTagNameIsEmpty
	}

	tag := &models.AccountTag{}
	has, err := s.UserDataDB(uid).NewSession(c).Where("uid=? AND deleted=? AND name=?", uid, false, tagName).Get(tag)

	if err != nil {
		return nil, err
	} else if !has {
		return nil, nil
	}

	return tag, nil
}

// ExistsTagName returns whether the account tag name exists
func (s *AccountTagService) ExistsTagName(c core.Context, uid int64, name string) (bool, error) {
	if uid <= 0 {
		return false, errs.ErrUserIdInvalid
	}

	tagName := strings.TrimSpace(name)

	if len(tagName) < 1 {
		return false, errs.ErrAccountTagNameIsEmpty
	}

	return s.UserDataDB(uid).NewSession(c).Where("uid=? AND deleted=? AND name=?", uid, false, tagName).Exist(&models.AccountTag{})
}

// GetMaxDisplayOrder returns the max display order
func (s *AccountTagService) GetMaxDisplayOrder(c core.Context, uid int64) (int32, error) {
	if uid <= 0 {
		return 0, errs.ErrUserIdInvalid
	}

	tag := &models.AccountTag{}
	has, err := s.UserDataDB(uid).NewSession(c).Cols("uid", "deleted", "display_order").Where("uid=? AND deleted=?", uid, false).OrderBy("display_order desc").Limit(1).Get(tag)

	if err != nil {
		return 0, err
	}

	if has {
		return tag.DisplayOrder, nil
	} else {
		return 0, nil
	}
}

// CreateTag saves a new account tag model to database
func (s *AccountTagService) CreateTag(c core.Context, tag *models.AccountTag) error {
	if tag.Uid <= 0 {
		return errs.ErrUserIdInvalid
	}

	tagName := strings.TrimSpace(tag.Name)

	if len(tagName) < 1 {
		return errs.ErrAccountTagNameIsEmpty
	}

	tag.Name = tagName

	exists, err := s.ExistsTagName(c, tag.Uid, tag.Name)

	if err != nil {
		return err
	} else if exists {
		return errs.ErrAccountTagNameAlreadyExists
	}

	tag.TagId = s.GenerateUuid(uuid.UUID_TYPE_TAG)

	if tag.TagId < 1 {
		return errs.ErrSystemIsBusy
	}

	tag.Deleted = false
	tag.CreatedUnixTime = time.Now().Unix()
	tag.UpdatedUnixTime = time.Now().Unix()

	return s.UserDataDB(tag.Uid).DoTransaction(c, func(sess *xorm.Session) error {
		_, err := sess.Insert(tag)
		return err
	})
}

// ModifyTag saves an existed account tag model to database
func (s *AccountTagService) ModifyTag(c core.Context, tag *models.AccountTag, oldTagName string) error {
	if tag.Uid <= 0 {
		return errs.ErrUserIdInvalid
	}

	tagName := strings.TrimSpace(tag.Name)

	if len(tagName) < 1 {
		return errs.ErrAccountTagNameIsEmpty
	}

	tag.Name = tagName

	if oldTagName != tag.Name {
		exists, err := s.ExistsTagName(c, tag.Uid, tag.Name)

		if err != nil {
			return err
		} else if exists {
			return errs.ErrAccountTagNameAlreadyExists
		}
	}

	tag.UpdatedUnixTime = time.Now().Unix()

	return s.UserDataDB(tag.Uid).DoTransaction(c, func(sess *xorm.Session) error {
		updatedRows, err := sess.ID(tag.TagId).Cols("name", "updated_unix_time").Where("uid=? AND deleted=?", tag.Uid, false).Update(tag)

		if err != nil {
			return err
		} else if updatedRows < 1 {
			return errs.ErrAccountTagNotFound
		}

		if oldTagName != tag.Name {
			if err := s.renameAccountsTagInSession(sess, tag.Uid, oldTagName, tag.Name); err != nil {
				return err
			}
		}

		return nil
	})
}

// HideTag updates hidden field of given account tags
func (s *AccountTagService) HideTag(c core.Context, uid int64, tagIds []int64, hidden bool) error {
	if uid <= 0 {
		return errs.ErrUserIdInvalid
	}

	if tagIds == nil {
		return errs.ErrAccountTagIdInvalid
	}

	updateModel := &models.AccountTag{
		Hidden:          hidden,
		UpdatedUnixTime: time.Now().Unix(),
	}

	return s.UserDataDB(uid).DoTransaction(c, func(sess *xorm.Session) error {
		updatedRows, err := sess.Cols("hidden", "updated_unix_time").Where("uid=? AND deleted=?", uid, false).In("tag_id", tagIds).Update(updateModel)

		if err != nil {
			return err
		} else if updatedRows < 1 {
			return errs.ErrAccountTagNotFound
		}

		return nil
	})
}

// ModifyTagDisplayOrders updates display order of given account tags
func (s *AccountTagService) ModifyTagDisplayOrders(c core.Context, uid int64, tags []*models.AccountTag) error {
	if uid <= 0 {
		return errs.ErrUserIdInvalid
	}

	return s.UserDataDB(uid).DoTransaction(c, func(sess *xorm.Session) error {
		for i := 0; i < len(tags); i++ {
			tag := tags[i]
			tag.UpdatedUnixTime = time.Now().Unix()

			updatedRows, err := sess.ID(tag.TagId).Cols("display_order", "updated_unix_time").Where("uid=? AND deleted=?", uid, false).Update(tag)

			if err != nil {
				return err
			} else if updatedRows < 1 {
				return errs.ErrAccountTagNotFound
			}
		}

		return nil
	})
}

// DeleteTag deletes an existed account tag from database
func (s *AccountTagService) DeleteTag(c core.Context, uid int64, tagId int64) error {
	if uid <= 0 {
		return errs.ErrUserIdInvalid
	}

	if tagId <= 0 {
		return errs.ErrAccountTagIdInvalid
	}

	tag := &models.AccountTag{}
	has, err := s.UserDataDB(uid).NewSession(c).ID(tagId).Where("uid=? AND deleted=?", uid, false).Get(tag)

	if err != nil {
		return err
	} else if !has {
		return errs.ErrAccountTagNotFound
	}

	inUse, err := s.hasAccountUsingTag(c, uid, tag.Name)

	if err != nil {
		return err
	} else if inUse {
		return errs.ErrAccountTagInUseCannotBeDeleted
	}

	tag.Deleted = true
	tag.DeletedUnixTime = time.Now().Unix()

	return s.UserDataDB(uid).DoTransaction(c, func(sess *xorm.Session) error {
		deletedRows, err := sess.Cols("deleted", "deleted_unix_time").Where("uid=? AND deleted=?", uid, false).In("tag_id", []int64{tagId}).Update(tag)

		if err != nil {
			return err
		} else if deletedRows < 1 {
			return errs.ErrAccountTagNotFound
		}

		return nil
	})
}

// DeleteAllTags deletes all existed account tags from database
func (s *AccountTagService) DeleteAllTags(c core.Context, uid int64) error {
	if uid <= 0 {
		return errs.ErrUserIdInvalid
	}

	updateModel := &models.AccountTag{
		Deleted:         true,
		DeletedUnixTime: time.Now().Unix(),
	}

	return s.UserDataDB(uid).DoTransaction(c, func(sess *xorm.Session) error {
		_, err := sess.Cols("deleted", "deleted_unix_time").Where("uid=? AND deleted=?", uid, false).Update(updateModel)
		return err
	})
}

// GetTagMapByList returns an account tag map by a list
func (s *AccountTagService) GetTagMapByList(tags []*models.AccountTag) map[int64]*models.AccountTag {
	if tags == nil {
		return nil
	}

	tagMap := make(map[int64]*models.AccountTag)

	for i := 0; i < len(tags); i++ {
		tagMap[tags[i].TagId] = tags[i]
	}

	return tagMap
}

// GetVisibleTagNameMapByList returns a visible account tag map by a list
func (s *AccountTagService) GetVisibleTagNameMapByList(tags []*models.AccountTag) map[string]*models.AccountTag {
	if tags == nil {
		return nil
	}

	tagMap := make(map[string]*models.AccountTag)

	for i := 0; i < len(tags); i++ {
		if tags[i].Hidden {
			continue
		}

		tagMap[tags[i].Name] = tags[i]
	}

	return tagMap
}

// GetTagNames returns a list of tag names
func (s *AccountTagService) GetTagNames(tags []*models.AccountTag) []string {
	if tags == nil {
		return nil
	}

	tagNames := make([]string, 0, len(tags))

	for i := 0; i < len(tags); i++ {
		tagNames = append(tagNames, tags[i].Name)
	}

	return tagNames
}

func (s *AccountTagService) renameAccountsTagInSession(sess *xorm.Session, uid int64, oldTagName string, newTagName string) error {
	if oldTagName == newTagName {
		return nil
	}

	var accounts []*models.Account
	err := sess.Where("uid=? AND deleted=?", uid, false).Find(&accounts)

	if err != nil {
		return err
	}

	now := time.Now().Unix()

	for i := 0; i < len(accounts); i++ {
		account := accounts[i]

		if account.Extend == nil {
			continue
		}

		updated := false

		if account.Extend.Tag == oldTagName {
			account.Extend.Tag = newTagName
			updated = true
		}

		if len(account.Extend.Tags) > 0 {
			for i := 0; i < len(account.Extend.Tags); i++ {
				if account.Extend.Tags[i] == oldTagName {
					account.Extend.Tags[i] = newTagName
					updated = true
				}
			}

			if updated {
				tagNameMap := make(map[string]bool, len(account.Extend.Tags))
				finalTagNames := make([]string, 0, len(account.Extend.Tags))

				for _, tagName := range account.Extend.Tags {
					if tagName == "" || tagNameMap[tagName] {
						continue
					}

					tagNameMap[tagName] = true
					finalTagNames = append(finalTagNames, tagName)
				}

				account.Extend.Tags = finalTagNames
			}
		}

		if !updated {
			continue
		}

		account.UpdatedUnixTime = now

		updatedRows, err := sess.ID(account.AccountId).Cols("extend", "updated_unix_time").Where("uid=? AND deleted=?", uid, false).Update(account)

		if err != nil {
			return err
		} else if updatedRows < 1 {
			return errs.ErrAccountNotFound
		}
	}

	return nil
}

func (s *AccountTagService) hasAccountUsingTag(c core.Context, uid int64, tagName string) (bool, error) {
	var accounts []*models.Account
	err := s.UserDataDB(uid).NewSession(c).Where("uid=? AND deleted=?", uid, false).Find(&accounts)

	if err != nil {
		return false, err
	}

	for i := 0; i < len(accounts); i++ {
		account := accounts[i]

		if account.Extend == nil {
			continue
		}

		if account.Extend.Tag == tagName {
			return true, nil
		}

		if len(account.Extend.Tags) > 0 {
			for _, tag := range account.Extend.Tags {
				if tag == tagName {
					return true, nil
				}
			}
		}
	}

	return false, nil
}
