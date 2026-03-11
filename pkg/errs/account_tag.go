package errs

import "net/http"

// Error codes related to account tags
var (
	ErrAccountTagIdInvalid            = NewNormalError(NormalSubcategoryTag, 100, http.StatusBadRequest, "account tag id is invalid")
	ErrAccountTagNotFound             = NewNormalError(NormalSubcategoryTag, 101, http.StatusBadRequest, "account tag not found")
	ErrAccountTagNameIsEmpty          = NewNormalError(NormalSubcategoryTag, 102, http.StatusBadRequest, "account tag name is empty")
	ErrAccountTagNameAlreadyExists    = NewNormalError(NormalSubcategoryTag, 103, http.StatusBadRequest, "account tag name already exists")
	ErrAccountTagInUseCannotBeDeleted = NewNormalError(NormalSubcategoryTag, 104, http.StatusBadRequest, "account tag is in use and cannot be deleted")
	ErrAccountTagIndexNotFound        = NewNormalError(NormalSubcategoryTag, 105, http.StatusBadRequest, "account tag index not found")
	ErrCannotUseHiddenAccountTag      = NewNormalError(NormalSubcategoryAccount, 10, http.StatusBadRequest, "cannot use hidden account tag")
)
