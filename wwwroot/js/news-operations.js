// news-operations.js - Shared functionality for news operations between Admin and User sides

/**
 * Shows the create news modal
 */
function showCreateNewsModal() {
    // Reset form if it exists
    const form = document.getElementById('createNewsForm');
    if (form) form.reset();

    // Reset TinyMCE if it exists
    if (typeof tinymce !== 'undefined' && tinymce.get('create-content')) {
        tinymce.get('create-content').setContent('');
    }

    // Clear image preview
    const imagePreview = document.querySelector('#createNewsModal .image-preview');
    if (imagePreview) imagePreview.classList.add('d-none');

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('createNewsModal'));
    modal.show();

    // Setup form submission
    setupCreateFormSubmission();
}

/**
 * Shows the edit news modal and loads data for the specified news item
 * @param {number} newsId - The ID of the news to edit
 * @param {boolean} isAdmin - Whether the current user is an admin
 */
function showEditNewsModal(newsId, isAdmin = false) {
    // Determine controller based on user role
    const controller = isAdmin ? 'AdminNews' : 'UserNews';

    // Fetch news details
    fetch(`/${controller}/GetNewsDetails/${newsId}`)
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                const form = document.getElementById('editNewsForm');
                if (form) {
                    // Set news ID
                    form.dataset.newsId = newsId;
                    document.getElementById('edit-news-id').value = newsId;

                    // Set title
                    const titleInput = document.getElementById('edit-title');
                    if (titleInput) titleInput.value = result.title;

                    // Set content in TinyMCE if it exists
                    if (typeof tinymce !== 'undefined' && tinymce.get('edit-content')) {
                        tinymce.get('edit-content').setContent(result.content);
                    } else {
                        // Or set in textarea
                        const contentTextarea = document.getElementById('edit-content');
                        if (contentTextarea) contentTextarea.value = result.content;
                    }

                    // Set category
                    const categorySelect = document.getElementById('edit-category');
                    if (categorySelect) categorySelect.value = result.categoryId;

                    // Set image URL and show preview if available
                    const imageUrlInput = document.getElementById('edit-image-url');
                    if (imageUrlInput) imageUrlInput.value = result.imageUrl || '';

                    if (result.imageUrl) {
                        const imagePreview = document.querySelector('#editNewsModal .image-preview');
                        const previewImage = imagePreview?.querySelector('img');
                        if (imagePreview && previewImage) {
                            previewImage.src = result.imageUrl;
                            imagePreview.classList.remove('d-none');
                        }
                    }

                    // Show modal
                    const modal = new bootstrap.Modal(document.getElementById('editNewsModal'));
                    modal.show();

                    // Setup form submission
                    setupEditFormSubmission(newsId, isAdmin);
                }
            } else {
                showToast(result.message || 'Không thể tải thông tin tin tức', 'danger');
            }
        })
        .catch(error => {
            console.error('Error fetching news details:', error);
            showToast('Không thể tải thông tin tin tức: ' + error.message, 'danger');
        });
}

/**
 * Sets up the create form submission with Fetch API
 */
function setupCreateFormSubmission() {
    const form = document.getElementById('createNewsForm');
    if (!form) return;

    // Remove existing listener if any
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    // Get if the form is for admin (auto-approve) or user (pending)
    const isAdmin = newForm.dataset.isAdmin === 'true';

    // Add new event listener
    newForm.addEventListener('submit', function (e) {
        e.preventDefault();

        // Get form data
        const formData = new FormData(newForm);

        // If using TinyMCE, get content from editor
        if (typeof tinymce !== 'undefined' && tinymce.get('create-content')) {
            formData.set('Content', tinymce.get('create-content').getContent());
        }

        // Find submit button
        const submitBtn = newForm.querySelector('button[type="submit"]');
        const originalBtnHtml = submitBtn.innerHTML;

        // Show loading state
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang xử lý...';
        submitBtn.disabled = true;

        // Get CSRF token
        const token = document.querySelector('input[name="__RequestVerificationToken"]').value;

        // Determine controller
        const controller = isAdmin ? 'AdminNews' : 'UserNews';

        // Submit with fetch
        fetch(`/${controller}/Create`, {
            method: 'POST',
            body: formData,
            headers: {
                'RequestVerificationToken': token
            }
        })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    // Hide modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('createNewsModal'));
                    modal.hide();

                    // Show success message
                    showToast(result.message || 'Tin tức đã được đăng thành công!', 'success');

                    // Reload page after delay
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    // Show error
                    showToast(result.message || 'Có lỗi xảy ra khi đăng tin.', 'danger');

                    // Reset button
                    submitBtn.innerHTML = originalBtnHtml;
                    submitBtn.disabled = false;
                }
            })
            .catch(error => {
                console.error('Error creating news:', error);
                showToast('Có lỗi xảy ra: ' + error.message, 'danger');

                // Reset button
                submitBtn.innerHTML = originalBtnHtml;
                submitBtn.disabled = false;
            });
    });

    // Set up image preview for file upload
    const imageFileInput = newForm.querySelector('input[name="ImageFile"]');
    if (imageFileInput) {
        imageFileInput.addEventListener('change', function (e) {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                const imagePreview = newForm.querySelector('.image-preview');
                const previewImage = imagePreview?.querySelector('img');

                reader.onload = function (e) {
                    if (previewImage && imagePreview) {
                        previewImage.src = e.target.result;
                        imagePreview.classList.remove('d-none');
                    }
                };

                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }

    // Set up image preview for URL
    const imageUrlInput = newForm.querySelector('input[name="ImageUrl"]');
    if (imageUrlInput) {
        imageUrlInput.addEventListener('input', function (e) {
            if (e.target.value) {
                const imageFileInput = newForm.querySelector('input[name="ImageFile"]');
                if (imageFileInput) imageFileInput.value = '';

                const imagePreview = newForm.querySelector('.image-preview');
                const previewImage = imagePreview?.querySelector('img');

                if (previewImage && imagePreview) {
                    previewImage.src = e.target.value;
                    imagePreview.classList.remove('d-none');
                }
            }
        });
    }
}

/**
 * Sets up the edit form submission with Fetch API
 * @param {number} newsId - The ID of the news being edited
 * @param {boolean} isAdmin - Whether the current user is an admin
 */
function setupEditFormSubmission(newsId, isAdmin = false) {
    const form = document.getElementById('editNewsForm');
    if (!form) return;

    // Remove existing listener if any
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    // Add new event listener
    newForm.addEventListener('submit', function (e) {
        e.preventDefault();

        // Get form data
        const formData = new FormData(newForm);

        // If using TinyMCE, get content from editor
        if (typeof tinymce !== 'undefined' && tinymce.get('edit-content')) {
            formData.set('Content', tinymce.get('edit-content').getContent());
        }

        // Find submit button
        const submitBtn = newForm.querySelector('button[type="submit"]');
        const originalBtnHtml = submitBtn.innerHTML;

        // Show loading state
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang xử lý...';
        submitBtn.disabled = true;

        // Get CSRF token
        const token = document.querySelector('input[name="__RequestVerificationToken"]').value;

        // Determine controller
        const controller = isAdmin ? 'AdminNews' : 'UserNews';

        // Submit with fetch
        fetch(`/${controller}/Edit/${newsId}`, {
            method: 'POST',
            body: formData,
            headers: {
                'RequestVerificationToken': token
            }
        })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    // Hide modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('editNewsModal'));
                    modal.hide();

                    // Show success message
                    showToast(result.message || 'Tin tức đã được cập nhật thành công!', 'success');

                    // Reload page after delay
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    // Show error
                    showToast(result.message || 'Có lỗi xảy ra khi cập nhật tin.', 'danger');

                    // Reset button
                    submitBtn.innerHTML = originalBtnHtml;
                    submitBtn.disabled = false;
                }
            })
            .catch(error => {
                console.error('Error updating news:', error);
                showToast('Có lỗi xảy ra: ' + error.message, 'danger');

                // Reset button
                submitBtn.innerHTML = originalBtnHtml;
                submitBtn.disabled = false;
            });
    });

    // Set up image preview for file upload
    const imageFileInput = newForm.querySelector('input[name="ImageFile"]');
    if (imageFileInput) {
        imageFileInput.addEventListener('change', function (e) {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                const imagePreview = newForm.querySelector('.image-preview');
                const previewImage = imagePreview?.querySelector('img');

                reader.onload = function (e) {
                    if (previewImage && imagePreview) {
                        previewImage.src = e.target.result;
                        imagePreview.classList.remove('d-none');
                    }
                };

                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }

    // Set up image preview for URL
    const imageUrlInput = newForm.querySelector('input[name="ImageUrl"]');
    if (imageUrlInput) {
        imageUrlInput.addEventListener('input', function (e) {
            if (e.target.value) {
                const imageFileInput = newForm.querySelector('input[name="ImageFile"]');
                if (imageFileInput) imageFileInput.value = '';

                const imagePreview = newForm.querySelector('.image-preview');
                const previewImage = imagePreview?.querySelector('img');

                if (previewImage && imagePreview) {
                    previewImage.src = e.target.value;
                    imagePreview.classList.remove('d-none');
                }
            }
        });
    }
}

/**
 * Shows a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success or danger)
 */
function showToast(message, type) {
    const toast = document.getElementById('successToast');
    if (!toast) return;

    toast.classList.remove('bg-success', 'bg-danger');
    toast.classList.add(type === 'danger' ? 'bg-danger' : 'bg-success');

    const toastMessage = document.getElementById('toastMessage');
    if (toastMessage) {
        toastMessage.textContent = message;
    }

    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}
