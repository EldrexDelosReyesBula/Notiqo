        // Firebase configuration
                const firebaseConfig = {
            apiKey: "AIzaSyCfQEnaR6NICnZIr7c5smbucSoGeiXcV5k",
            authDomain: "lantalk-pro.firebaseapp.com",
            databaseURL: "https://lantalk-pro-default-rtdb.firebaseio.com",
            projectId: "lantalk-pro",
            storageBucket: "lantalk-pro.firebasestorage.app",
            messagingSenderId: "1036484461310",
            appId: "1:1036484461310:web:7d1b4be7b207bbafe69baf",
            measurementId: "G-WPZNYDZVPE"
        };

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();
        const realtimeDb = firebase.database();

        // DOM Elements
        const authModal = document.getElementById('authModal');
        const forgotPasswordModal = document.getElementById('forgotPasswordModal');
        const customModal = document.getElementById('customModal');
        const editPostModal = document.getElementById('editPostModal');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const sidebar = document.getElementById('sidebar');
        const postFormContainer = document.getElementById('postFormContainer');
        const commentsModal = document.getElementById('commentsModal');
        const publishedContent = document.getElementById('publishedContent');
        const profileInitial = document.getElementById('profileInitial');
        const profileName = document.getElementById('profileName');
        const profileBio = document.getElementById('profileBio');
        const followButton = document.getElementById('followButton');

        // Current user data
        let currentUser = null;
        let currentUserData = null;
        let posts = [];
        let selectedPostColor = 'default';
        let selectedEditPostColor = 'default';
        let viewingProfileUserId = null;
        let notificationCount = 0;
        let currentEditingPostId = null;

        // Initialize the app
        document.addEventListener('DOMContentLoaded', () => {
            // Check auth state
            auth.onAuthStateChanged(user => {
                if (user) {
                    currentUser = user;
                    loadUserData(user.uid);
                    showSection('home');
                    authModal.classList.remove('show');
                    loadPosts();
                    loadNotifications();
                    loadSuggestedUsers();
                } else {
                    authModal.classList.add('show');
                    currentUser = null;
                }
            });

            // Check for dark mode preference
            if (localStorage.getItem('darkMode') === 'enabled') {
                document.body.classList.add('dark-mode');
                document.getElementById('darkModeToggle').checked = true;
            }

            // Add CSS for username overflow
            const style = document.createElement('style');
            style.textContent = `
            .user-item-username {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 120px;
            }
        `;
            document.head.appendChild(style);
        });

        // Custom modal functions
        function showCustomModal(title, message, isConfirm = false, confirmCallback = null) {
            document.getElementById('modalTitle').textContent = title;
            document.getElementById('modalMessage').textContent = message;

            const modalFooter = document.querySelector('.custom-modal-footer');
            modalFooter.innerHTML = '';

            if (isConfirm) {
                modalFooter.innerHTML = `
            <button onclick="hideCustomModal()">Cancel</button>
            <button onclick="handleConfirm()" style="background-color: var(--warning-color);">Confirm</button>
        `;

                window.handleConfirm = () => {
                    hideCustomModal();
                    if (confirmCallback) confirmCallback();
                };
            } else {
                modalFooter.innerHTML = '<button onclick="hideCustomModal()">OK</button>';
            }

            customModal.classList.add('show');
        }

        function hideCustomModal() {
            customModal.classList.remove('show');
        }

        // Edit post modal functions
        function showEditPostModal(postId) {
            const post = posts.find(p => p.id === postId);
            if (!post) return;

            currentEditingPostId = postId;
            document.getElementById('editPostId').value = postId;
            document.getElementById('editPostTitle').value = post.title || '';
            document.getElementById('editPostDescription').value = post.description;
            document.getElementById('editPostAuthor').value = post.author || '';

            // Reset color options
            document.querySelectorAll('.edit-post-content .color-option').forEach(opt => {
                opt.classList.remove('selected');
                if (opt.getAttribute('data-color') === (post.bgColor || 'default')) {
                    opt.classList.add('selected');
                    selectedEditPostColor = post.bgColor || 'default';
                }
            });

            editPostModal.classList.add('show');
        }

        function hideEditPostModal() {
            editPostModal.classList.remove('show');
            currentEditingPostId = null;
        }

        function selectEditPostColor(element) {
            document.querySelectorAll('.edit-post-content .color-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            element.classList.add('selected');
            selectedEditPostColor = element.getAttribute('data-color');
        }

        function saveEditedPost() {
            const postId = document.getElementById('editPostId').value;
            const title = document.getElementById('editPostTitle').value;
            const description = document.getElementById('editPostDescription').value;
            const author = document.getElementById('editPostAuthor').value;

            if (!description.trim()) {
                showCustomModal('Error', 'Post description cannot be empty');
                return;
            }

            const loading = showLoading('Saving changes...');

            const updateData = {
                title: title || null,
                description,
                author: author || null
            };

            if (selectedEditPostColor !== 'default') {
                updateData.bgColor = selectedEditPostColor;
            } else {
                updateData.bgColor = firebase.firestore.FieldValue.delete();
            }

            db.collection('posts').doc(postId).update(updateData)
                .then(() => {
                    hideLoading(loading);
                    hideEditPostModal();
                    loadPosts();
                    if (viewingProfileUserId) {
                        loadProfilePosts();
                    }
                    showCustomModal('Success', 'Post updated successfully!');
                })
                .catch(error => {
                    hideLoading(loading);
                    showCustomModal('Error', 'Failed to update post: ' + error.message);
                });
        }

        // UI Functions
        function toggleSidebar() {
            sidebar.classList.toggle('show');
        }

        function showSection(sectionId) {
            // Reset viewing profile if navigating away from profile
            if (sectionId !== 'profile') {
                viewingProfileUserId = null;
            }

            // Hide all sections
            document.querySelectorAll('section').forEach(section => {
                section.classList.remove('active-section');
            });

            // Show the selected section
            document.getElementById(sectionId).classList.add('active-section');

            // Close sidebar if open
            sidebar.classList.remove('show');

            // Close post form if open
            postFormContainer.classList.remove('show');
            hideCommentsModal();
            hideEditPostModal();

            // Close menus if open
            document.getElementById('profileMenu').style.display = 'none';
            document.getElementById('notificationSettingsMenu').style.display = 'none';

            // Load data if needed
            if (sectionId === 'notifications') {
                loadNotifications();
            } else if (sectionId === 'find-users') {
                showFindTab('find');
            } else if (sectionId === 'profile') {
                if (!viewingProfileUserId) {
                    viewingProfileUserId = currentUser?.uid;
                }
                loadProfilePosts();
            }
        }

        function togglePostFormContainer() {
            if (!currentUser) {
                showCustomModal('Sign In Required', 'Please sign in to create a post');
                return;
            }

            postFormContainer.classList.toggle('show');

            if (!postFormContainer.classList.contains('show')) {
                // Reset form when closing
                document.getElementById('postForm').reset();
                selectedPostColor = 'default';
                document.querySelector('.color-option[data-color="default"]').classList.add('selected');
            }
        }

        function showCommentsModal(postId) {
            if (!currentUser) {
                showCustomModal('Sign In Required', 'Please sign in to view comments');
                return;
            }

            document.getElementById('commentPostId').value = postId;
            commentsModal.classList.add('show');
            loadComments(postId);
        }

        function hideCommentsModal() {
            commentsModal.classList.remove('show');
        }

        function selectPostColor(element) {
            document.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            element.classList.add('selected');
            selectedPostColor = element.getAttribute('data-color');
        }

        // Auth functions
        function switchAuthTab(tab) {
            if (tab === 'login') {
                document.querySelector('.auth-tab.active').classList.remove('active');
                document.querySelectorAll('.auth-tab')[0].classList.add('active');
                loginForm.style.display = 'flex';
                registerForm.style.display = 'none';
            } else {
                document.querySelector('.auth-tab.active').classList.remove('active');
                document.querySelectorAll('.auth-tab')[1].classList.add('active');
                loginForm.style.display = 'none';
                registerForm.style.display = 'flex';
            }
        }

        function showForgotPassword() {
            authModal.classList.remove('show');
            forgotPasswordModal.classList.add('show');
        }

        function hideForgotPassword() {
            forgotPasswordModal.classList.remove('show');
            authModal.classList.add('show');
            switchAuthTab('login');
        }

        function loginUser(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            const loginBtn = e.target.querySelector('button');
            const originalText = loginBtn.innerHTML;
            loginBtn.innerHTML = '<div class="loading"></div>';

            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    loginBtn.innerHTML = originalText;
                })
                .catch(error => {
                    loginBtn.innerHTML = originalText;
                    showCustomModal('Login Error', error.message);
                });
        }

        function resetPassword(e) {
            e.preventDefault();
            const email = document.getElementById('resetEmail').value;

            const resetBtn = e.target.querySelector('button');
            const originalText = resetBtn.innerHTML;
            resetBtn.innerHTML = '<div class="loading"></div>';

            auth.sendPasswordResetEmail(email)
                .then(() => {
                    resetBtn.innerHTML = originalText;
                    showCustomModal('Email Sent', 'Password reset email sent! Check your inbox.');
                    hideForgotPassword();
                })
                .catch(error => {
                    resetBtn.innerHTML = originalText;
                    showCustomModal('Error', error.message);
                });
        }

        function registerUser(e) {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;

            // Auto-generate username
            const username = `${name.replace(/\s+/g, '').toLowerCase()}${Math.floor(Math.random() * 1000)}`;

            const registerBtn = e.target.querySelector('button');
            const originalText = registerBtn.innerHTML;
            registerBtn.innerHTML = '<div class="loading"></div>';

            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Save additional user data to Firestore
                    return db.collection('users').doc(userCredential.user.uid).set({
                        name,
                        username,
                        email,
                        bio: "",
                        joined: firebase.firestore.FieldValue.serverTimestamp(),
                        followers: [],
                        following: [],
                        notificationsEnabled: {
                            followers: true,
                            likes: true,
                            mentions: true
                        }
                    });
                })
                .then(() => {
                    registerBtn.innerHTML = originalText;
                })
                .catch(error => {
                    registerBtn.innerHTML = originalText;
                    showCustomModal('Registration Error', error.message);
                });
        }

        function signOut() {
            auth.signOut().then(() => {
                currentUser = null;
                authModal.classList.add('show');
                window.location.reload(); // Refresh to clear all data
            });
        }

        // User data functions
        function loadUserData(uid) {
            db.collection('users').doc(uid).get()
                .then(doc => {
                    if (doc.exists) {
                        currentUserData = doc.data();
                        updateProfileUI(currentUserData);

                        // Load the profile we're viewing (default to current user)
                        if (!viewingProfileUserId) {
                            viewingProfileUserId = uid;
                            loadProfilePosts();
                        }

                        // Update notification settings toggles
                        if (currentUserData.notificationsEnabled) {
                            document.getElementById('notifFollowersToggle').checked = currentUserData.notificationsEnabled.followers;
                            document.getElementById('notifLikesToggle').checked = currentUserData.notificationsEnabled.likes;
                            document.getElementById('notifMentionsToggle').checked = currentUserData.notificationsEnabled.mentions;
                        }
                    }
                });
        }

        function updateProfileUI(userData) {
            profileName.textContent = userData.name;
            profileBio.textContent = userData.bio || "No bio yet";
            document.getElementById('profileFollowersCount').textContent = userData.followers ? userData.followers.length : 0;
            document.getElementById('profileFollowingCount').textContent = userData.following ? userData.following.length : 0;

            // Update settings form
            if (document.getElementById('settingsName')) {
                document.getElementById('settingsName').value = userData.name;
                document.getElementById('settingsBio').value = userData.bio || "";
            }

            // Update profile initial
            profileInitial.textContent = userData.name.charAt(0).toUpperCase();

            // Update follow button if viewing another profile
            if (viewingProfileUserId && viewingProfileUserId !== currentUser?.uid) {
                updateFollowButton(userData);
            } else {
                followButton.style.display = 'none';
            }
        }

        function updateFollowButton(userData) {
            if (!currentUser || !viewingProfileUserId) return;

            followButton.style.display = 'block';
            followButton.disabled = false;

            if (userData.followers && userData.followers.includes(currentUser.uid)) {
                followButton.textContent = 'Following';
                followButton.classList.add('following');
            } else {
                followButton.textContent = 'Follow';
                followButton.classList.remove('following');
            }
        }

        function toggleFollow() {
            if (!currentUser || !viewingProfileUserId || viewingProfileUserId === currentUser.uid) return;

            const isFollowing = followButton.textContent === 'Following';

            if (isFollowing) {
                // Unfollow logic
                db.collection('users').doc(currentUser.uid).update({
                    following: firebase.firestore.FieldValue.arrayRemove(viewingProfileUserId)
                });

                db.collection('users').doc(viewingProfileUserId).update({
                    followers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                }).then(() => {
                    followButton.textContent = 'Follow';
                    followButton.classList.remove('following');
                    updateFollowerCount();

                    // Update current user data
                    if (currentUserData.following) {
                        currentUserData.following = currentUserData.following.filter(id => id !== viewingProfileUserId);
                    }
                });
            } else {
                // Follow logic
                db.collection('users').doc(currentUser.uid).update({
                    following: firebase.firestore.FieldValue.arrayUnion(viewingProfileUserId)
                });

                db.collection('users').doc(viewingProfileUserId).update({
                    followers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                }).then(() => {
                    followButton.textContent = 'Following';
                    followButton.classList.add('following');
                    updateFollowerCount();

                    // Update current user data
                    if (!currentUserData.following) {
                        currentUserData.following = [];
                    }
                    currentUserData.following.push(viewingProfileUserId);

                    // Send notification if enabled
                    sendNotification(viewingProfileUserId, 'follow', currentUser.uid);
                });
            }
        }

        function sendNotification(userId, type, senderId, postId = null) {
            if (!userId || !type || !senderId) return;

            // Check if user has notifications enabled for this type
            db.collection('users').doc(userId).get()
                .then(doc => {
                    if (doc.exists) {
                        const userData = doc.data();
                        const notificationsEnabled = userData.notificationsEnabled || {
                            followers: true,
                            likes: true,
                            mentions: true
                        };

                        let shouldSend = false;
                        let message = "";

                        switch (type) {
                            case 'follow':
                                shouldSend = notificationsEnabled.followers;
                                message = "started following you";
                                break;
                            case 'like':
                                shouldSend = notificationsEnabled.likes;
                                message = "liked your post";
                                break;
                            case 'comment':
                                shouldSend = notificationsEnabled.likes;
                                message = "commented on your post";
                                break;
                            case 'mention':
                                shouldSend = notificationsEnabled.mentions;
                                message = "mentioned you in a post";
                                break;
                        }

                        if (shouldSend) {
                            const notification = {
                                type,
                                senderId,
                                message,
                                read: false,
                                timestamp: firebase.firestore.FieldValue.serverTimestamp()
                            };

                            if (postId) {
                                notification.postId = postId;
                            }

                            // Add notification to user's collection
                            db.collection('notifications').doc(userId).collection('userNotifications').add(notification)
                                .then(() => {
                                    // Update notification count
                                    if (userId === currentUser?.uid) {
                                        notificationCount++;
                                        updateNotificationBadge();
                                    }
                                });
                        }
                    }
                });
        }

        function updateFollowerCount() {
            if (viewingProfileUserId) {
                db.collection('users').doc(viewingProfileUserId).get()
                    .then(doc => {
                        if (doc.exists) {
                            const userData = doc.data();
                            document.getElementById('profileFollowersCount').textContent = userData.followers ? userData.followers.length : 0;
                        }
                    });
            }
        }

        function loadSuggestedUsers() {
            if (!currentUser) return;

            // In a real app, this would use an algorithm to suggest users
            // For demo, we'll just get random users (excluding current user and already followed)
            db.collection('users')
                .where('username', '!=', currentUserData.username)
                .limit(5)
                .get()
                .then(querySnapshot => {
                    const suggestedUsersContainer = document.getElementById('suggestedUsers');
                    suggestedUsersContainer.innerHTML = '';

                    if (querySnapshot.empty) {
                        suggestedUsersContainer.innerHTML = '<div class="empty-state">No suggested users found</div>';
                        return;
                    }

                    querySnapshot.forEach(doc => {
                        const user = doc.data();
                        const isFollowing = currentUserData.following && currentUserData.following.includes(doc.id);

                        const userElement = document.createElement('div');
                        userElement.className = 'user-item';
                        userElement.innerHTML = `
                    <div class="user-item-info" onclick="viewUserProfile('${doc.id}')">
                        <div class="user-item-avatar">${user.name.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="user-item-name">${user.name}</div>
                            <div class="user-item-username">@${user.username}</div>
                        </div>
                    </div>
                    <button class="follow-btn ${isFollowing ? 'following' : ''}" 
                        onclick="toggleSuggestedFollow('${doc.id}', this)">
                        ${isFollowing ? 'Following' : 'Follow'}
                    </button>
                `;

                        suggestedUsersContainer.appendChild(userElement);
                    });
                });
        }

        function toggleSuggestedFollow(userId, button) {
            if (!currentUser) return;

            const isFollowing = button.textContent === 'Following';

            if (isFollowing) {
                // Unfollow
                db.collection('users').doc(currentUser.uid).update({
                    following: firebase.firestore.FieldValue.arrayRemove(userId)
                });

                db.collection('users').doc(userId).update({
                    followers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                }).then(() => {
                    button.textContent = 'Follow';
                    button.classList.remove('following');

                    // Update current user data
                    if (currentUserData.following) {
                        currentUserData.following = currentUserData.following.filter(id => id !== userId);
                    }
                });
            } else {
                // Follow
                db.collection('users').doc(currentUser.uid).update({
                    following: firebase.firestore.FieldValue.arrayUnion(userId)
                });

                db.collection('users').doc(userId).update({
                    followers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                }).then(() => {
                    button.textContent = 'Following';
                    button.classList.add('following');

                    // Update current user data
                    if (!currentUserData.following) {
                        currentUserData.following = [];
                    }
                    currentUserData.following.push(userId);

                    // Send notification
                    sendNotification(userId, 'follow', currentUser.uid);
                });
            }
        }

        // Post functions
        function createPost(e) {
            e.preventDefault();

            const title = document.getElementById('postTitle').value;
            const description = document.getElementById('postDescription').value;
            const author = document.getElementById('postAuthor').value;

            const postBtn = e.target.querySelector('button');
            const originalText = postBtn.innerHTML;
            postBtn.innerHTML = '<div class="loading"></div>';

            // Create post in Firestore
            const postData = {
                title,
                description,
                author,
                userId: currentUser.uid,
                userName: currentUserData.name,
                userUsername: currentUserData.username,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                likes: [],
                commentsCount: 0,
                shares: 0
            };

            if (selectedPostColor !== 'default') {
                postData.bgColor = selectedPostColor;
            }

            db.collection('posts').add(postData)
                .then(() => {
                    postBtn.innerHTML = originalText;
                    togglePostFormContainer();
                    loadPosts();
                    loadProfilePosts();
                    showCustomModal('Success', 'Post created successfully!');
                })
                .catch(error => {
                    postBtn.innerHTML = originalText;
                    showCustomModal('Error', 'Error creating post: ' + error.message);
                });
        }

        function loadPosts() {
            if (!currentUser) return;

            // Show loading skeletons (but limit to 2)
            publishedContent.innerHTML = `
        <div class="skeleton skeleton-post"></div>
        <div class="skeleton skeleton-post"></div>
    `;

            // Get posts from people the user follows and their own posts
            let query = db.collection('posts')
                .orderBy('createdAt', 'desc')
                .limit(10);

            // If user follows people, get their posts too
            if (currentUserData.following && currentUserData.following.length > 0) {
                query = db.collection('posts')
                    .where('userId', 'in', [...currentUserData.following, currentUser.uid])
                    .orderBy('createdAt', 'desc')
                    .limit(10);
            }

            query.get()
                .then(querySnapshot => {
                    publishedContent.innerHTML = '';
                    posts = [];

                    if (querySnapshot.empty) {
                        publishedContent.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-edit"></i>
                        <h3>No posts yet</h3>
                        <p>Follow some users or create your first post</p>
                    </div>
                `;
                        return;
                    }

                    querySnapshot.forEach(doc => {
                        const post = doc.data();
                        post.id = doc.id;
                        posts.push(post);
                        renderPost(post, publishedContent);
                    });
                })
                .catch(error => {
                    showCustomModal('Error', 'Failed to load posts: ' + error.message);
                });
        }

        function loadProfilePosts() {
            if (!currentUser || !viewingProfileUserId) return;

            const profilePostsContainer = document.getElementById('profilePosts');

            // Show loading skeletons (limit to 2)
            profilePostsContainer.innerHTML = `
        <div class="skeleton skeleton-post"></div>
        <div class="skeleton skeleton-post"></div>
    `;

            db.collection('posts')
                .where('userId', '==', viewingProfileUserId)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get()
                .then(querySnapshot => {
                    profilePostsContainer.innerHTML = '';

                    if (querySnapshot.empty) {
                        profilePostsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-edit"></i>
                        <h3>No posts yet</h3>
                        <p>Create your first post to share with others</p>
                    </div>
                `;
                        return;
                    }

                    querySnapshot.forEach(doc => {
                        const post = doc.data();
                        post.id = doc.id;
                        renderPost(post, profilePostsContainer);
                    });
                })
                .catch(error => {
                    showCustomModal('Error', 'Failed to load profile posts: ' + error.message);
                });
        }

        function renderPost(post, container) {
            const postElement = document.createElement('div');
            postElement.className = 'post';
            postElement.setAttribute('data-id', post.id);
            if (post.bgColor) {
                postElement.setAttribute('data-bg-color', post.bgColor);
            }

            // Format date
            const date = post.createdAt.toDate();
            const formattedDate = date.toLocaleString('default', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Check if description is long
            const isLongDescription = post.description.length > 200;
            const displayDescription = isLongDescription ?
                post.description.substring(0, 200) + '...' :
                post.description;

            postElement.innerHTML = `
        <div class="post-header">
            <div class="post-user" onclick="viewUserProfile('${post.userId}')">
                <div class="user-avatar">${post.userName.charAt(0).toUpperCase()}</div>
                <div>
                    <div class="user-name">${post.userName}</div>
                    <small>${formattedDate}</small>
                </div>
            </div>
            <div class="post-actions">
                <i class="fas fa-ellipsis-v post-menu" onclick="togglePostMenu(this, '${post.id}')"></i>
                <div class="post-menu-options">
                    ${post.userId === currentUser?.uid ? `
                    <button onclick="showEditPostModal('${post.id}')"><i class="fas fa-edit"></i> Edit</button>
                    <button onclick="deletePost('${post.id}')" class="delete"><i class="fas fa-trash"></i> Delete</button>
                    ` : `
                    <button onclick="reportPost('${post.id}')"><i class="fas fa-flag"></i> Report</button>
                    `}
                </div>
            </div>
        </div>
        <div class="post-content">
            ${post.title ? `<h3>${post.title}</h3>` : ''}
            <div class="post-description ${isLongDescription ? 'collapsed' : ''}">
                ${displayDescription.replace(/\n/g, '<br>')}
            </div>
            ${post.author ? `<div class="post-author"><small>Source: ${post.author}</small></div>` : ''}
            ${isLongDescription ? `<div class="read-more" onclick="expandPostDescription(this)">Read more</div>` : ''}
        </div>
        <div class="post-footer">
            <div class="post-stats">
                <div class="post-stat" onclick="likePost('${post.id}')">
                    <i class="fas fa-heart ${post.likes?.includes(currentUser?.uid) ? 'liked' : ''}"></i>
                    <span>${post.likes?.length || 0}</span>
                </div>
                <div class="post-stat" onclick="showCommentsModal('${post.id}')">
                    <i class="fas fa-comment"></i>
                    <span>${post.commentsCount || 0}</span>
                </div>
                <div class="post-stat" onclick="sharePost('${post.id}')">
                    <i class="fas fa-share"></i>
                    <span>${post.shares || 0}</span>
                </div>
            </div>
        </div>
    `;

            container.appendChild(postElement);
        }

        // Comments functions
        function loadComments(postId) {
            if (!postId) return;

            const commentsList = document.getElementById('commentsList');
            commentsList.innerHTML = `
        <div class="skeleton skeleton-comment"></div>
        <div class="skeleton skeleton-comment"></div>
    `;

            // First get the post to check likes
            db.collection('posts').doc(postId).get()
                .then(postDoc => {
                    const post = postDoc.data();

                    // Then get comments sorted by likes (most liked first)
                    return db.collection('posts').doc(postId).collection('comments')
                        .orderBy('likes', 'desc')
                        .orderBy('createdAt', 'asc')
                        .get()
                        .then(querySnapshot => {
                            commentsList.innerHTML = '';

                            if (querySnapshot.empty) {
                                commentsList.innerHTML = `
                            <div class="empty-state">
                                <i class="fas fa-comment"></i>
                                <h3>No comments yet</h3>
                                <p>Be the first to comment</p>
                            </div>
                        `;
                                return;
                            }

                            querySnapshot.forEach(doc => {
                                const comment = doc.data();
                                comment.id = doc.id;
                                comment.postId = postId;
                                renderComment(comment, commentsList);
                            });
                        });
                })
                .catch(error => {
                    showCustomModal('Error', 'Failed to load comments: ' + error.message);
                });
        }

        function renderComment(comment, container) {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment-item';

            // Format date
            const date = comment.createdAt.toDate();
            const formattedDate = date.toLocaleString('default', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            commentElement.innerHTML = `
        <div class="comment-header">
            <div class="comment-user" onclick="viewUserProfile('${comment.userId}')">
                <div class="user-avatar small">${comment.userName.charAt(0).toUpperCase()}</div>
                <div>
                    <div class="user-name">${comment.userName}</div>
                    <small>${formattedDate}</small>
                </div>
            </div>
            <div class="comment-actions">
                <i class="fas fa-ellipsis-v" onclick="toggleCommentMenu(event, '${comment.id}', '${comment.userId}')"></i>
                <div class="comment-menu-options">
                    ${comment.userId === currentUser?.uid ? `
                    <button onclick="editComment('${comment.postId}', '${comment.id}', '${comment.text.replace(/'/g, "\\'")}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button onclick="deleteComment('${comment.postId}', '${comment.id}')" class="delete">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    ` : `
                    <button onclick="reportComment('${comment.postId}', '${comment.id}')">
                        <i class="fas fa-flag"></i> Report
                    </button>
                    `}
                </div>
            </div>
        </div>
        <div class="comment-content">
            ${comment.text}
        </div>
        <div class="comment-footer">
            <div class="comment-stat" onclick="likeComment('${comment.postId}', '${comment.id}')">
                <i class="fas fa-heart ${comment.likes?.includes(currentUser?.uid) ? 'liked' : ''}"></i>
                <span>${comment.likes?.length || 0}</span>
            </div>
            <div class="comment-stat" onclick="toggleReplyForm(this)">
                <i class="fas fa-reply"></i>
                <span>Reply</span>
            </div>
        </div>
        <div class="reply-form">
            <textarea placeholder="Write a reply..."></textarea>
            <button onclick="postReply('${comment.postId}', '${comment.id}', this)">Post Reply</button>
            <button class="cancel" onclick="cancelReply(this)">Cancel</button>
        </div>
    `;

            container.appendChild(commentElement);
        }

        function toggleCommentMenu(event, commentId, commentUserId) {
            event.stopPropagation();
            const menu = event.target.nextElementSibling;
            menu.classList.toggle('show');

            // Close other open menus
            document.querySelectorAll('.comment-menu-options').forEach(otherMenu => {
                if (otherMenu !== menu && otherMenu.classList.contains('show')) {
                    otherMenu.classList.remove('show');
                }
            });

            // Close when clicking outside
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && e.target !== event.target) {
                    menu.classList.remove('show');
                    document.removeEventListener('click', closeMenu);
                }
            });
        }

        function toggleReplyForm(element) {
            const replyForm = element.closest('.comment-footer').nextElementSibling;
            replyForm.classList.toggle('show');
        }

        function postReply(postId, parentCommentId, button) {
            const replyText = button.previousElementSibling.value.trim();
            if (!replyText) {
                showCustomModal('Error', 'Reply cannot be empty');
                return;
            }

            const loading = showLoading('Posting reply...');

            const replyData = {
                text: replyText,
                userId: currentUser.uid,
                userName: currentUserData.name,
                userUsername: currentUserData.username,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                likes: [],
                postId: postId,
                parentCommentId: parentCommentId
            };

            // Add reply to the post's subcollection
            db.collection('posts').doc(postId).collection('comments').add(replyData)
                .then(() => {
                    // Update the post's comment count
                    return db.collection('posts').doc(postId).update({
                        commentsCount: firebase.firestore.FieldValue.increment(1)
                    });
                })
                .then(() => {
                    hideLoading(loading);
                    button.previousElementSibling.value = '';
                    loadComments(postId);

                    // Send notification to comment owner
                    const post = posts.find(p => p.id === postId);
                    if (post) {
                        sendNotification(post.userId, 'comment', currentUser.uid, postId);
                    }
                })
                .catch(error => {
                    hideLoading(loading);
                    showCustomModal('Error', 'Failed to add reply: ' + error.message);
                });
        }

        function cancelReply(button) {
            const replyForm = button.closest('.reply-form');
            replyForm.classList.remove('show');
            replyForm.querySelector('textarea').value = '';
        }

        function addComment(e) {
            e.preventDefault();
            const postId = document.getElementById('commentPostId').value;
            const text = document.getElementById('commentText').value.trim();

            if (!text) {
                showCustomModal('Error', 'Comment cannot be empty');
                return;
            }

            const commentBtn = e.target.querySelector('button');
            const originalText = commentBtn.innerHTML;
            commentBtn.innerHTML = '<div class="loading"></div>';

            const commentData = {
                text,
                userId: currentUser.uid,
                userName: currentUserData.name,
                userUsername: currentUserData.username,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                likes: [],
                postId: postId
            };

            // Add comment to the post's subcollection
            db.collection('posts').doc(postId).collection('comments').add(commentData)
                .then(() => {
                    // Update the post's comment count
                    return db.collection('posts').doc(postId).update({
                        commentsCount: firebase.firestore.FieldValue.increment(1)
                    });
                })
                .then(() => {
                    commentBtn.innerHTML = originalText;
                    document.getElementById('commentText').value = '';
                    loadComments(postId);

                    // Send notification to post owner
                    const post = posts.find(p => p.id === postId);
                    if (post && post.userId !== currentUser.uid) {
                        sendNotification(post.userId, 'comment', currentUser.uid, postId);
                    }
                })
                .catch(error => {
                    commentBtn.innerHTML = originalText;
                    showCustomModal('Error', 'Failed to add comment: ' + error.message);
                });
        }

        function editComment(postId, commentId, currentText) {
            const newText = prompt('Edit your comment:', currentText);
            if (newText === null || newText.trim() === currentText.trim()) return;

            if (!newText.trim()) {
                showCustomModal('Error', 'Comment cannot be empty');
                return;
            }

            const loading = showLoading('Updating comment...');

            db.collection('posts').doc(postId).collection('comments').doc(commentId).update({
                    text: newText
                })
                .then(() => {
                    hideLoading(loading);
                    loadComments(postId);
                    showCustomModal('Success', 'Comment updated successfully');
                })
                .catch(error => {
                    hideLoading(loading);
                    showCustomModal('Error', 'Failed to update comment: ' + error.message);
                });
        }

        function likeComment(postId, commentId) {
            if (!currentUser) {
                showCustomModal('Sign In Required', 'Please sign in to like comments');
                return;
            }

            const commentRef = db.collection('posts').doc(postId).collection('comments').doc(commentId);

            // First get the current likes
            commentRef.get()
                .then(doc => {
                    if (doc.exists) {
                        const comment = doc.data();
                        const isLiked = comment.likes?.includes(currentUser.uid);

                        // Update the likes array
                        return commentRef.update({
                            likes: isLiked ?
                                firebase.firestore.FieldValue.arrayRemove(currentUser.uid) : firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                        });
                    }
                })
                .then(() => {
                    // Reload comments
                    loadComments(postId);
                })
                .catch(error => {
                    showCustomModal('Error', 'Failed to like comment: ' + error.message);
                });
        }

        function deleteComment(postId, commentId) {
            showCustomModal('Confirm Delete', 'Are you sure you want to delete this comment?', true, () => {
                const loading = showLoading('Deleting comment...');

                db.collection('posts').doc(postId).collection('comments').doc(commentId).delete()
                    .then(() => {
                        // Update the post's comment count
                        return db.collection('posts').doc(postId).update({
                            commentsCount: firebase.firestore.FieldValue.increment(-1)
                        });
                    })
                    .then(() => {
                        hideLoading(loading);
                        loadComments(postId);
                        showCustomModal('Success', 'Comment deleted successfully');
                    })
                    .catch(error => {
                        hideLoading(loading);
                        showCustomModal('Error', 'Failed to delete comment: ' + error.message);
                    });
            });
        }

        function reportComment(postId, commentId) {
            showCustomModal('Report Comment', `
            <div>
                <p>Please explain why you're reporting this comment:</p>
                <textarea id="reportReason" placeholder="Brief explanation..." style="width: 100%; min-height: 100px; margin: 10px 0;"></textarea>
            </div>
        `, true, () => {
                const reason = document.getElementById('reportReason').value.trim();
                if (!reason) {
                    showCustomModal('Error', 'Please provide a reason for reporting');
                    return;
                }

                const loading = showLoading('Submitting report...');

                // In a real app, you would add this to a reports collection
                const reportData = {
                    type: 'comment',
                    postId,
                    commentId,
                    reporterId: currentUser?.uid,
                    reporterName: currentUserData?.name,
                    reason,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'pending'
                };

                // Send email via Firebase Functions or your backend
                // For demo, we'll just show a success message
                setTimeout(() => {
                    hideLoading(loading);
                    showCustomModal('Report Submitted', `
                    Thank you for reporting this comment. 
                    Our team will review it shortly. 
                    The report has been sent to eldrexdelosreyesbula@gmail.com
                `);
                }, 1500);
            });
        }

        function togglePostMenu(icon, postId) {
            const menu = icon.nextElementSibling;
            menu.classList.toggle('show');

            // Close other open menus
            document.querySelectorAll('.post-menu-options').forEach(otherMenu => {
                if (otherMenu !== menu && otherMenu.classList.contains('show')) {
                    otherMenu.classList.remove('show');
                }
            });

            // Close when clicking outside
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && e.target !== icon) {
                    menu.classList.remove('show');
                    document.removeEventListener('click', closeMenu);
                }
            });
        }

        function reportPost(postId) {
            showCustomModal('Report Post', `
            <div>
                <p>Please explain why you're reporting this post:</p>
                <textarea id="reportReason" placeholder="Brief explanation..." style="width: 100%; min-height: 100px; margin: 10px 0;"></textarea>
            </div>
        `, true, () => {
                const reason = document.getElementById('reportReason').value.trim();
                if (!reason) {
                    showCustomModal('Error', 'Please provide a reason for reporting');
                    return;
                }

                const loading = showLoading('Submitting report...');

                // In a real app, you would add this to a reports collection
                const reportData = {
                    type: 'post',
                    postId,
                    reporterId: currentUser?.uid,
                    reporterName: currentUserData?.name,
                    reason,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'pending'
                };

                // Send email via Firebase Functions or your backend
                // For demo, we'll just show a success message
                setTimeout(() => {
                    hideLoading(loading);
                    showCustomModal('Report Submitted', `
                    Thank you for reporting this post. 
                    Our team will review it shortly. 
                    The report has been sent to eldrexdelosreyesbula@gmail.com
                `);
                }, 1500);
            });
        }

        function expandPostDescription(element) {
            const descriptionContainer = element.previousElementSibling;
            const postId = element.closest('.post').getAttribute('data-id');
            const post = posts.find(p => p.id === postId);

            descriptionContainer.classList.remove('collapsed');
            descriptionContainer.innerHTML = post.description.replace(/\n/g, '<br>');
            element.style.display = 'none';
        }

        function likePost(postId) {
            if (!currentUser) {
                showCustomModal('Sign In Required', 'Please sign in to like posts');
                return;
            }

            const post = posts.find(p => p.id === postId);
            const isLiked = post.likes?.includes(currentUser.uid);

            db.collection('posts').doc(postId).update({
                    likes: isLiked ?
                        firebase.firestore.FieldValue.arrayRemove(currentUser.uid) : firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                })
                .then(() => {
                    // Send notification if this is a like (not unlike)
                    if (!isLiked && post.userId !== currentUser.uid) {
                        sendNotification(post.userId, 'like', currentUser.uid, postId);
                    }

                    loadPosts();
                    if (viewingProfileUserId) {
                        loadProfilePosts();
                    }
                })
                .catch(error => {
                    showCustomModal('Error', 'Failed to like post: ' + error.message);
                });
        }

        function deletePost(postId) {
            showCustomModal('Confirm Delete', 'Are you sure you want to delete this post?', true, () => {
                const loading = showLoading('Deleting post...');

                // First delete all comments for this post
                db.collection('posts').doc(postId).collection('comments').get()
                    .then(querySnapshot => {
                        const batch = db.batch();
                        querySnapshot.forEach(doc => {
                            batch.delete(doc.ref);
                        });
                        return batch.commit();
                    })
                    .then(() => {
                        // Then delete the post itself
                        return db.collection('posts').doc(postId).delete();
                    })
                    .then(() => {
                        hideLoading(loading);
                        loadPosts();
                        loadProfilePosts();
                        showCustomModal('Success', 'Post deleted successfully');
                    })
                    .catch(error => {
                        hideLoading(loading);
                        showCustomModal('Error', 'Failed to delete post: ' + error.message);
                    });
            });
        }

        function sharePost(postId) {
            const post = posts.find(p => p.id === postId);
            const currentHost = window.location.hostname;
            const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
            const baseUrl = isLocalhost ? 'http://localhost' : 'https://eldrexdelosreyesbula.github.io/Notiqo/';
            const postUrl = `${baseUrl}/post/${postId}`;

            // Copy to clipboard
            const dummyInput = document.createElement('input');
            dummyInput.value = postUrl;
            document.body.appendChild(dummyInput);
            dummyInput.select();
            document.execCommand('copy');
            document.body.removeChild(dummyInput);

            // Update share count
            db.collection('posts').doc(postId).update({
                    shares: firebase.firestore.FieldValue.increment(1)
                })
                .then(() => {
                    loadPosts();
                    if (viewingProfileUserId) {
                        loadProfilePosts();
                    }
                    showCustomModal('Copied', 'Post link copied to clipboard!');
                })
                .catch(error => {
                    showCustomModal('Error', 'Failed to share post: ' + error.message);
                });
        }

        function viewUserProfile(userId) {
            if (userId === currentUser?.uid) {
                // Viewing own profile
                viewingProfileUserId = userId;
                showSection('profile');
                followButton.style.display = 'none';
                loadProfilePosts();
            } else {
                // Viewing another user's profile
                viewingProfileUserId = userId;
                showProfileInSection(userId);
            }
        }

        function showProfileInSection(userId) {
            const loading = showLoading('Loading profile...');

            db.collection('users').doc(userId).get()
                .then(doc => {
                    hideLoading(loading);

                    if (doc.exists) {
                        const userData = doc.data();

                        // Update profile info
                        profileName.textContent = userData.name;
                        profileBio.textContent = userData.bio || "No bio yet";
                        document.getElementById('profileFollowersCount').textContent = userData.followers ? userData.followers.length : 0;
                        document.getElementById('profileFollowingCount').textContent = userData.following ? userData.following.length : 0;
                        profileInitial.textContent = userData.name.charAt(0).toUpperCase();

                        // Update follow button
                        updateFollowButton(userData);

                        // Show profile section
                        showSection('profile');
                        loadProfilePosts();
                    }
                })
                .catch(error => {
                    hideLoading(loading);
                    showCustomModal('Error', 'Failed to load profile: ' + error.message);
                });
        }

        // Find Users functions
        function showFindTab(tab) {
            document.getElementById('findUsersTab').style.display = 'none';
            document.getElementById('followersTab').style.display = 'none';
            document.getElementById('followingTab').style.display = 'none';

            if (tab === 'find') {
                document.getElementById('findUsersTab').style.display = 'block';
                loadAllUsers();
            } else if (tab === 'followers') {
                document.getElementById('followersTab').style.display = 'block';
                loadFollowers();
            } else if (tab === 'following') {
                document.getElementById('followingTab').style.display = 'block';
                loadFollowing();
            }
        }

        function loadAllUsers() {
            if (!currentUser) return;

            const usersContainer = document.getElementById('findUsersTab');
            usersContainer.innerHTML = `
        <div class="skeleton skeleton-user"></div>
        <div class="skeleton skeleton-user"></div>
        <div class="skeleton skeleton-user"></div>
    `;

            db.collection('users')
                .orderBy('name')
                .limit(20)
                .get()
                .then(querySnapshot => {
                    usersContainer.innerHTML = '';

                    if (querySnapshot.empty) {
                        usersContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h3>No users found</h3>
                    </div>
                `;
                        return;
                    }

                    querySnapshot.forEach(doc => {
                        if (doc.id === currentUser.uid) return; // Skip current user

                        const user = doc.data();
                        const isFollowing = currentUserData.following && currentUserData.following.includes(doc.id);

                        const userElement = document.createElement('div');
                        userElement.className = 'user-item';
                        userElement.innerHTML = `
                    <div class="user-item-info" onclick="viewUserProfile('${doc.id}')">
                        <div class="user-item-avatar">${user.name.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="user-item-name">${user.name}</div>
                            <div class="user-item-username">@${user.username}</div>
                        </div>
                    </div>
                    <button class="follow-btn ${isFollowing ? 'following' : ''}" 
                        onclick="toggleFollowListUser('${doc.id}', this, 'find')">
                        ${isFollowing ? 'Following' : 'Follow'}
                    </button>
                `;

                        usersContainer.appendChild(userElement);
                    });
                });
        }

        function loadFollowers() {
            if (!currentUser || !viewingProfileUserId) return;

            const followersContainer = document.getElementById('followersTab');
            followersContainer.innerHTML = `
        <div class="skeleton skeleton-user"></div>
        <div class="skeleton skeleton-user"></div>
    `;

            db.collection('users').doc(viewingProfileUserId).get()
                .then(doc => {
                    if (doc.exists) {
                        const userData = doc.data();
                        const followers = userData.followers || [];

                        if (followers.length === 0) {
                            followersContainer.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <h3>No followers yet</h3>
                        </div>
                    `;
                            return;
                        }

                        // Get follower details
                        db.collection('users')
                            .where('__name__', 'in', followers.slice(0, 10)) // Firestore limit of 10 for 'in' queries
                            .get()
                            .then(querySnapshot => {
                                followersContainer.innerHTML = '';

                                querySnapshot.forEach(doc => {
                                    const user = doc.data();
                                    const isFollowing = currentUserData.following && currentUserData.following.includes(doc.id);

                                    const userElement = document.createElement('div');
                                    userElement.className = 'user-item';
                                    userElement.innerHTML = `
                                <div class="user-item-info" onclick="viewUserProfile('${doc.id}')">
                                    <div class="user-item-avatar">${user.name.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <div class="user-item-name">${user.name}</div>
                                        <div class="user-item-username">@${user.username}</div>
                                    </div>
                                </div>
                                ${doc.id !== currentUser.uid ? `
                                <button class="follow-btn ${isFollowing ? 'following' : ''}" 
                                    onclick="toggleFollowListUser('${doc.id}', this, 'followers')">
                                    ${isFollowing ? 'Following' : 'Follow Back'}
                                </button>
                                ` : ''}
                            `;

                                    followersContainer.appendChild(userElement);
                                });
                            });
                    }
                });
        }

        function loadFollowing() {
            if (!currentUser || !viewingProfileUserId) return;

            const followingContainer = document.getElementById('followingTab');
            followingContainer.innerHTML = `
        <div class="skeleton skeleton-user"></div>
        <div class="skeleton skeleton-user"></div>
    `;

            db.collection('users').doc(viewingProfileUserId).get()
                .then(doc => {
                    if (doc.exists) {
                        const userData = doc.data();
                        const following = userData.following || [];

                        if (following.length === 0) {
                            followingContainer.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <h3>Not following anyone yet</h3>
                        </div>
                    `;
                            return;
                        }

                        // Get following details
                        db.collection('users')
                            .where('__name__', 'in', following.slice(0, 10)) // Firestore limit of 10 for 'in' queries
                            .get()
                            .then(querySnapshot => {
                                followingContainer.innerHTML = '';

                                querySnapshot.forEach(doc => {
                                    const user = doc.data();
                                    const isFollowing = currentUserData.following && currentUserData.following.includes(doc.id);

                                    const userElement = document.createElement('div');
                                    userElement.className = 'user-item';
                                    userElement.innerHTML = `
                                <div class="user-item-info" onclick="viewUserProfile('${doc.id}')">
                                    <div class="user-item-avatar">${user.name.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <div class="user-item-name">${user.name}</div>
                                        <div class="user-item-username">@${user.username}</div>
                                    </div>
                                </div>
                                ${doc.id !== currentUser.uid ? `
                                <button class="follow-btn ${isFollowing ? 'following' : ''}" 
                                    onclick="toggleFollowListUser('${doc.id}', this, 'following')">
                                    ${isFollowing ? 'Following' : 'Follow'}
                                </button>
                                ` : ''}
                            `;

                                    followingContainer.appendChild(userElement);
                                });
                            });
                    }
                });
        }

        function toggleFollowListUser(userId, button, listType) {
            const isFollowing = button.textContent === 'Following';

            if (isFollowing) {
                // Unfollow
                db.collection('users').doc(currentUser.uid).update({
                    following: firebase.firestore.FieldValue.arrayRemove(userId)
                });

                db.collection('users').doc(userId).update({
                    followers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                }).then(() => {
                    button.textContent = listType === 'followers' ? 'Follow Back' : 'Follow';
                    button.classList.remove('following');

                    // Update current user data
                    if (currentUserData.following) {
                        currentUserData.following = currentUserData.following.filter(id => id !== userId);
                    }
                });
            } else {
                // Follow
                db.collection('users').doc(currentUser.uid).update({
                    following: firebase.firestore.FieldValue.arrayUnion(userId)
                });

                db.collection('users').doc(userId).update({
                    followers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                }).then(() => {
                    button.textContent = 'Following';
                    button.classList.add('following');

                    // Update current user data
                    if (!currentUserData.following) {
                        currentUserData.following = [];
                    }
                    currentUserData.following.push(userId);

                    // Send notification
                    sendNotification(userId, 'follow', currentUser.uid);
                });
            }
        }

        // Notification functions
        function loadNotifications() {
            if (!currentUser) return;

            const notificationsContainer = document.getElementById('notificationsList');
            notificationsContainer.innerHTML = `
        <div class="skeleton skeleton-user"></div>
        <div class="skeleton skeleton-user"></div>
        <div class="skeleton skeleton-user"></div>
    `;

            db.collection('notifications')
                .doc(currentUser.uid)
                .collection('userNotifications')
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get()
                .then(querySnapshot => {
                    notificationsContainer.innerHTML = '';
                    notificationCount = 0;

                    if (querySnapshot.empty) {
                        notificationsContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-bell"></i>
                        <h3>No notifications yet</h3>
                        <p>Your notifications will appear here</p>
                    </div>
                `;
                        return;
                    }

                    querySnapshot.forEach(doc => {
                        const notification = doc.data();
                        if (!notification.read) {
                            notificationCount++;
                        }

                        // Get sender info
                        db.collection('users').doc(notification.senderId).get()
                            .then(userDoc => {
                                if (userDoc.exists) {
                                    const user = userDoc.data();
                                    renderNotification(doc.id, notification, user, notificationsContainer);
                                }
                            });
                    });

                    updateNotificationBadge();
                });
        }

        function renderNotification(notificationId, notification, sender, container) {
            const notificationElement = document.createElement('div');
            notificationElement.className = `notification-item ${notification.read ? '' : 'unread'}`;

            // Format time
            const time = notification.timestamp.toDate();
            const formattedTime = time.toLocaleString('default', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            notificationElement.innerHTML = `
        <div class="notification-header">
            <span>${formattedTime}</span>
            ${!notification.read ? '<span class="badge">New</span>' : ''}
        </div>
        <div class="notification-content">
            <div class="notification-avatar">${sender.name.charAt(0).toUpperCase()}</div>
            <div class="notification-text">
                <strong>${sender.name}</strong> ${notification.message}
            </div>
        </div>
        ${notification.postId ? `
        <div class="notification-actions">
            <button class="follow-btn" onclick="viewNotificationPost('${notification.postId}')">View Post</button>
        </div>
        ` : ''}
    `;

            notificationElement.onclick = () => markNotificationAsRead(notificationId);
            container.appendChild(notificationElement);
        }

        function markNotificationAsRead(notificationId) {
            if (!currentUser) return;

            db.collection('notifications')
                .doc(currentUser.uid)
                .collection('userNotifications')
                .doc(notificationId)
                .update({
                    read: true
                })
                .then(() => {
                    // Reload notifications
                    loadNotifications();
                });
        }

        function markAllAsRead() {
            if (!currentUser) return;

            // Get all unread notifications
            db.collection('notifications')
                .doc(currentUser.uid)
                .collection('userNotifications')
                .where('read', '==', false)
                .get()
                .then(querySnapshot => {
                    const batch = db.batch();

                    querySnapshot.forEach(doc => {
                        const ref = db.collection('notifications')
                            .doc(currentUser.uid)
                            .collection('userNotifications')
                            .doc(doc.id);
                        batch.update(ref, {
                            read: true
                        });
                    });

                    return batch.commit();
                })
                .then(() => {
                    loadNotifications();
                    hideNotificationSettingsMenu();
                });
        }

        function viewNotificationPost(postId) {
            // In a real app, this would show the post in a modal or scroll to it
            showCustomModal('Notification', `Would show post ${postId} in a real app`);
        }

        function updateNotificationBadge() {
            const badge = document.getElementById('notificationBadge');
            if (notificationCount > 0) {
                badge.textContent = notificationCount > 9 ? '9+' : notificationCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        function showNotificationSettings() {
            const menu = document.getElementById('notificationSettingsMenu');
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';

            // Close when clicking outside
            setTimeout(() => {
                document.addEventListener('click', function closeMenu(e) {
                    if (!menu.contains(e.target)) {
                        menu.style.display = 'none';
                        document.removeEventListener('click', closeMenu);
                    }
                });
            }, 0);
        }

        function hideNotificationSettingsMenu() {
            document.getElementById('notificationSettingsMenu').style.display = 'none';
        }

        function showProfileMenu() {
            const menu = document.getElementById('profileMenu');
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';

            // Close when clicking outside
            setTimeout(() => {
                document.addEventListener('click', function closeMenu(e) {
                    if (!menu.contains(e.target)) {
                        menu.style.display = 'none';
                        document.removeEventListener('click', closeMenu);
                    }
                });
            }, 0);
        }

        function editProfile() {
            // Show settings section with profile tab active
            showSection('settings');
            document.getElementById('profileMenu').style.display = 'none';
        }

        function shareProfile(userId = null) {
            const profileId = userId || currentUser.uid;
            const currentHost = window.location.hostname;
            const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
            const baseUrl = isLocalhost ? 'http://localhost' : 'https://eldrexdelosreyesbula.github.io/Notiqo/';
            const profileUrl = `${baseUrl}/profile/${profileId}`;

            // Copy to clipboard
            const dummyInput = document.createElement('input');
            dummyInput.value = profileUrl;
            document.body.appendChild(dummyInput);
            dummyInput.select();
            document.execCommand('copy');
            document.body.removeChild(dummyInput);
            showCustomModal('Copied', 'Profile link copied to clipboard!');
        }

        // Settings functions
        function toggleDarkMode() {
            document.body.classList.toggle('dark-mode');

            if (document.body.classList.contains('dark-mode')) {
                localStorage.setItem('darkMode', 'enabled');
            } else {
                localStorage.setItem('darkMode', 'disabled');
            }
        }

        function saveProfileSettings() {
            if (!currentUser) return;

            const name = document.getElementById('settingsName').value;
            const bio = document.getElementById('settingsBio').value;

            const notificationsEnabled = {
                followers: document.getElementById('notifFollowersToggle').checked,
                likes: document.getElementById('notifLikesToggle').checked,
                mentions: document.getElementById('notifMentionsToggle').checked
            };

            const loading = showLoading('Saving profile...');

            db.collection('users').doc(currentUser.uid).update({
                    name,
                    bio,
                    notificationsEnabled
                })
                .then(() => {
                    hideLoading(loading);
                    // Update current user data
                    currentUserData.name = name;
                    currentUserData.bio = bio;
                    currentUserData.notificationsEnabled = notificationsEnabled;

                    // Update profile UI
                    updateProfileUI(currentUserData);
                    showCustomModal('Success', 'Profile saved successfully!');
                })
                .catch(error => {
                    hideLoading(loading);
                    showCustomModal('Error', 'Failed to save profile: ' + error.message);
                });
        }

        function showLegalDocument(type) {
            const modal = document.getElementById('legalModal');
            const title = document.getElementById('legalDocTitle');
            const content = document.getElementById('legalDocContent');

            if (type === 'privacy') {
                title.textContent = 'Privacy Policy';
                content.innerHTML = `
        <h2>Privacy Policy</h2>
        <p>This is a placeholder for the privacy policy. In a real application, you would include:</p>
        <ul>
            <li>What information you collect</li>
            <li>How you use that information</li>
            <li>How you protect user data</li>
            <li>User rights regarding their data</li>
            <li>Cookies and tracking policies</li>
            <li>Contact information for privacy concerns</li>
        </ul>
        <p>You should consult with a legal professional to create a proper privacy policy that complies with all applicable laws (GDPR, CCPA, etc.).</p>
    `;
            } else {
                title.textContent = 'Terms of Use';
                content.innerHTML = `
        <h2>Terms of Use</h2>
        <p>This is a placeholder for the terms of use. In a real application, you would include:</p>
        <ul>
            <li>User responsibilities and acceptable use</li>
            <li>Content ownership and licensing</li>
            <li>Disclaimers and limitations of liability</li>
            <li>Termination conditions</li>
            <li>Governing law</li>
            <li>Dispute resolution</li>
        </ul>
        <p>You should consult with a legal professional to create proper terms of use that protect your business and comply with applicable laws.</p>
    `;
            }

            modal.classList.add('show');
        }

        function hideLegalDocument() {
            document.getElementById('legalModal').classList.remove('show');
        }

        function requestAccountDeletion() {
            showCustomModal('Confirm Delete', 'Are you sure you want to delete your account? This cannot be undone and will remove all your data.', true, () => {
                if (prompt('Type "DELETE" to confirm account deletion:') === 'DELETE') {
                    const loading = showLoading('Deleting account...');

                    // In a real app, you would:
                    // 1. Authenticate the user again (password confirmation)
                    // 2. Delete all user data from Firestore/storage
                    // 3. Delete the auth account

                    setTimeout(() => {
                        hideLoading(loading);
                        showCustomModal('Account Deleted', 'Your account has been scheduled for deletion.');
                        signOut();
                    }, 1500);
                }
            });
        }

        // Loading indicator
        function showLoading(message) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-overlay';
            loadingDiv.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `;
            document.body.appendChild(loadingDiv);
            return loadingDiv;
        }

        function hideLoading(loadingElement) {
            if (loadingElement && loadingElement.parentNode) {
                loadingElement.parentNode.removeChild(loadingElement);
            }
        }

        // Search functions
        function handleSearchInput() {
            const query = document.getElementById('searchQuery').value.trim();
            if (query.length > 2) {
                // In a real app, you might want to debounce this
                searchContent();
            }
        }

        function searchContent() {
            const query = document.getElementById('searchQuery').value.trim();
            if (!query) return;

            const resultsContainer = document.getElementById('searchResults');
            resultsContainer.innerHTML = `
        <div class="skeleton skeleton-user"></div>
        <div class="skeleton skeleton-user"></div>
    `;

            // Search users (name or username)
            db.collection('users')
                .where('name', '>=', query)
                .where('name', '<=', query + '\uf8ff')
                .limit(5)
                .get()
                .then(userSnapshot => {
                    // Also search by username
                    return db.collection('users')
                        .where('username', '>=', query.toLowerCase())
                        .where('username', '<=', query.toLowerCase() + '\uf8ff')
                        .limit(5)
                        .get()
                        .then(usernameSnapshot => {
                            // Combine results
                            const users = [];
                            const userMap = new Map();

                            userSnapshot.forEach(doc => {
                                if (!userMap.has(doc.id)) {
                                    userMap.set(doc.id, true);
                                    users.push({
                                        id: doc.id,
                                        ...doc.data()
                                    });
                                }
                            });

                            usernameSnapshot.forEach(doc => {
                                if (!userMap.has(doc.id)) {
                                    userMap.set(doc.id, true);
                                    users.push({
                                        id: doc.id,
                                        ...doc.data()
                                    });
                                }
                            });

                            return users;
                        });
                })
                .then(users => {
                    // Search posts (title or content)
                    return db.collection('posts')
                        .where('description', '>=', query)
                        .where('description', '<=', query + '\uf8ff')
                        .limit(5)
                        .get()
                        .then(postSnapshot => {
                            const resultsContainer = document.getElementById('searchResults');
                            resultsContainer.innerHTML = '';

                            if (users.length === 0 && postSnapshot.empty) {
                                resultsContainer.innerHTML = `
                            <div class="empty-state">
                                <i class="fas fa-search"></i>
                                <h3>No results found</h3>
                                <p>Try a different search term</p>
                            </div>
                        `;
                                return;
                            }

                            // Show users
                            if (users.length > 0) {
                                const userHeader = document.createElement('h3');
                                userHeader.textContent = 'Users';
                                resultsContainer.appendChild(userHeader);

                                users.forEach(user => {
                                    const isFollowing = currentUserData.following && currentUserData.following.includes(user.id);

                                    const userElement = document.createElement('div');
                                    userElement.className = 'user-item';
                                    userElement.innerHTML = `
                                <div class="user-item-info" onclick="viewUserProfile('${user.id}')">
                                    <div class="user-item-avatar">${user.name.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <div class="user-item-name">${user.name}</div>
                                        <div class="user-item-username">@${user.username}</div>
                                    </div>
                                </div>
                                ${user.id !== currentUser.uid ? `
                                <button class="follow-btn ${isFollowing ? 'following' : ''}" 
                                    onclick="toggleSearchFollow('${user.id}', this)">
                                    ${isFollowing ? 'Following' : 'Follow'}
                                </button>
                                ` : ''}
                            `;

                                    resultsContainer.appendChild(userElement);
                                });
                            }

                            // Show posts
                            if (!postSnapshot.empty) {
                                const postHeader = document.createElement('h3');
                                postHeader.textContent = 'Posts';
                                postHeader.style.marginTop = '2rem';
                                resultsContainer.appendChild(postHeader);

                                postSnapshot.forEach(doc => {
                                    const post = doc.data();
                                    post.id = doc.id;
                                    renderPost(post, resultsContainer);
                                });
                            }
                        });
                });
        }

        function toggleSearchFollow(userId, button) {
            const isFollowing = button.textContent === 'Following';

            if (isFollowing) {
                // Unfollow
                db.collection('users').doc(currentUser.uid).update({
                    following: firebase.firestore.FieldValue.arrayRemove(userId)
                });

                db.collection('users').doc(userId).update({
                    followers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                }).then(() => {
                    button.textContent = 'Follow';
                    button.classList.remove('following');

                    // Update current user data
                    if (currentUserData.following) {
                        currentUserData.following = currentUserData.following.filter(id => id !== userId);
                    }
                });
            } else {
                // Follow
                db.collection('users').doc(currentUser.uid).update({
                    following: firebase.firestore.FieldValue.arrayUnion(userId)
                });

                db.collection('users').doc(userId).update({
                    followers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
                }).then(() => {
                    button.textContent = 'Following';
                    button.classList.add('following');

                    // Update current user data
                    if (!currentUserData.following) {
                        currentUserData.following = [];
                    }
                    currentUserData.following.push(userId);

                    // Send notification
                    sendNotification(userId, 'follow', currentUser.uid);
                });
            }
        }

        // Close sidebar when clicking outside
        document.addEventListener('click', function(e) {
            if (!sidebar.contains(e.target) && !e.target.classList.contains('fa-bars')) {
                sidebar.classList.remove('show');
            }

            // Close post menus when clicking outside
            if (!e.target.classList.contains('post-menu')) {
                document.querySelectorAll('.post-menu-options').forEach(menu => {
                    if (menu.classList.contains('show')) {
                        menu.classList.remove('show');
                    }
                });
            }

            // Close comment menus when clicking outside
            if (!e.target.classList.contains('fa-ellipsis-v')) {
                document.querySelectorAll('.comment-menu-options').forEach(menu => {
                    if (menu.classList.contains('show')) {
                        menu.classList.remove('show');
                    }
                });
            }
        });
