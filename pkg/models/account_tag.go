package models

// AccountTag represents account tag data stored in database
type AccountTag struct {
	TagId           int64  `xorm:"PK"`
	Uid             int64  `xorm:"INDEX(IDX_account_tag_uid_deleted_order) NOT NULL"`
	Deleted         bool   `xorm:"INDEX(IDX_account_tag_uid_deleted_order) NOT NULL"`
	Name            string `xorm:"VARCHAR(64) NOT NULL"`
	DisplayOrder    int32  `xorm:"INDEX(IDX_account_tag_uid_deleted_order) NOT NULL"`
	Hidden          bool   `xorm:"NOT NULL"`
	CreatedUnixTime int64
	UpdatedUnixTime int64
	DeletedUnixTime int64
}

// AccountTagGetRequest represents all parameters of account tag getting request
type AccountTagGetRequest struct {
	Id int64 `form:"id,string" binding:"required,min=1"`
}

// AccountTagCreateRequest represents all parameters of account tag creation request
type AccountTagCreateRequest struct {
	Name string `json:"name" binding:"required,notBlank,max=64"`
}

// AccountTagModifyRequest represents all parameters of account tag modification request
type AccountTagModifyRequest struct {
	Id   int64  `json:"id,string" binding:"required,min=1"`
	Name string `json:"name" binding:"required,notBlank,max=64"`
}

// AccountTagHideRequest represents all parameters of account tag hiding request
type AccountTagHideRequest struct {
	Id     int64 `json:"id,string" binding:"required,min=1"`
	Hidden bool  `json:"hidden"`
}

// AccountTagMoveRequest represents all parameters of account tag moving request
type AccountTagMoveRequest struct {
	NewDisplayOrders []*AccountTagNewDisplayOrderRequest `json:"newDisplayOrders" binding:"required,min=1"`
}

// AccountTagNewDisplayOrderRequest represents a data pair of id and display order
type AccountTagNewDisplayOrderRequest struct {
	Id           int64 `json:"id,string" binding:"required,min=1"`
	DisplayOrder int32 `json:"displayOrder"`
}

// AccountTagDeleteRequest represents all parameters of account tag deleting request
type AccountTagDeleteRequest struct {
	Id int64 `json:"id,string" binding:"required,min=1"`
}

// AccountTagInfoResponse represents a view-object of account tag
type AccountTagInfoResponse struct {
	Id           int64  `json:"id,string"`
	Name         string `json:"name"`
	DisplayOrder int32  `json:"displayOrder"`
	Hidden       bool   `json:"hidden"`
}

// FillFromOtherTag fills all the fields in this current tag from other account tag
func (t *AccountTag) FillFromOtherTag(tag *AccountTag) {
	t.TagId = tag.TagId
	t.Uid = tag.Uid
	t.Deleted = tag.Deleted
	t.Name = tag.Name
	t.DisplayOrder = tag.DisplayOrder
	t.Hidden = tag.Hidden
	t.CreatedUnixTime = tag.CreatedUnixTime
	t.UpdatedUnixTime = tag.UpdatedUnixTime
	t.DeletedUnixTime = tag.DeletedUnixTime
}

// ToAccountTagInfoResponse returns a view-object according to database model
func (t *AccountTag) ToAccountTagInfoResponse() *AccountTagInfoResponse {
	return &AccountTagInfoResponse{
		Id:           t.TagId,
		Name:         t.Name,
		DisplayOrder: t.DisplayOrder,
		Hidden:       t.Hidden,
	}
}

// AccountTagInfoResponseSlice represents the slice data structure of AccountTagInfoResponse
type AccountTagInfoResponseSlice []*AccountTagInfoResponse

// Len returns the count of items
func (s AccountTagInfoResponseSlice) Len() int {
	return len(s)
}

// Swap swaps two items
func (s AccountTagInfoResponseSlice) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

// Less reports whether the first item is less than the second one
func (s AccountTagInfoResponseSlice) Less(i, j int) bool {
	return s[i].DisplayOrder < s[j].DisplayOrder
}
