document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    const tabs = document.querySelectorAll('.tab');
    const dropzoneArea = document.getElementById('dropzone-area');
    const urlArea = document.getElementById('url-area');
    const uploadLimits = document.getElementById('upload-limits');
    const mediaUpload = document.getElementById('media-upload');
    const socialUrlInput = document.getElementById('social-url');
    let currentTabType = 'video';
    let latestReportData = null;

    if (tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                currentTabType = tab.getAttribute('data-type');
                const tabTypeInput = document.getElementById('tabType');
                if (tabTypeInput) {
                    tabTypeInput.value = currentTabType;
                }
                
                // Sync sidebar if matching type
                document.querySelectorAll('.nav-item').forEach(nav => {
                    nav.classList.remove('active');
                    if (nav.getAttribute('data-type') === currentTabType) {
                        nav.classList.add('active');
                    }
                });
                
                if (currentTabType === 'video') {
                    dropzoneArea.style.display = 'flex';
                    urlArea.style.display = 'none';
                    mediaUpload.accept = 'video/*';
                    uploadLimits.textContent = 'Limit: 250MB | MP4, MKV';
                } else if (currentTabType === 'article') {
                    dropzoneArea.style.display = 'flex';
                    urlArea.style.display = 'none';
                    mediaUpload.accept = 'image/*,application/pdf';
                    uploadLimits.textContent = 'Limit: 50MB | JPG, PNG, PDF';
                } else if (currentTabType === 'social') {
                    dropzoneArea.style.display = 'none';
                    urlArea.style.display = 'block';
                }
            });
        });
    }

    // Sidebar sync logic
    const navItems = document.querySelectorAll('.nav-menu .nav-item[data-type]');
    navItems.forEach(nav => {
        nav.addEventListener('click', (e) => {
            e.preventDefault();
            const targetType = nav.getAttribute('data-type');
            // Find corresponding main tab and click it
            const targetTab = Array.from(tabs).find(t => t.getAttribute('data-type') === targetType);
            if (targetTab) {
                targetTab.click();
            }
        });
    });



    // Headline Area Toggle
    const headlineToggleBtn = document.getElementById('headline-toggle-btn');
    const headlineArea = document.getElementById('headline-area');

    if (headlineToggleBtn && headlineArea) {
        headlineToggleBtn.addEventListener('click', () => {
            headlineArea.classList.toggle('show');
        });
    }

    // File Upload handling
    const uploadText = document.getElementById('upload-text');
    const uploadIcon = document.getElementById('upload-icon');

    if (mediaUpload) {
        mediaUpload.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                uploadText.textContent = e.target.files[0].name;
                uploadIcon.textContent = 'check_circle';
                uploadIcon.style.color = 'var(--primary)';
            } else {
                uploadText.textContent = 'Drag & drop news clip or image here';
                uploadIcon.textContent = 'cloud_upload';
                uploadIcon.style.color = 'var(--on-surface-variant)';
            }
        });
    }

    // Form Submission
    const verifyForm = document.getElementById('verify-form');
    const submitBtn = document.getElementById('btn-submit');
    const submitIcon = document.getElementById('submit-icon');
    const submitText = document.getElementById('submit-text');
    
    // Result panels
    const emptyState = document.getElementById('empty-state');
    const resultsPanel = document.getElementById('results-panel');
    const modalityPanel = document.getElementById('modality-panel');
    const diagnosticPanel = document.getElementById('diagnostic-panel');

    if (verifyForm) {
        verifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (currentTabType !== 'social') {
                const file = mediaUpload.files[0];
                if (!file) {
                    alert("Please select a file to analyze.");
                    return;
                }
            } else {
                if (!socialUrlInput.value.trim()) {
                    alert("Please enter a social media URL.");
                    return;
                }
            }

            // Set loading state
            submitBtn.style.opacity = '0.7';
            submitBtn.style.pointerEvents = 'none';
            submitIcon.textContent = 'hourglass_empty';
            submitText.textContent = 'Analyzing...';
            
            const formData = new FormData(verifyForm);

            try {
                const response = await fetch('/api/verify', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) throw new Error("Verification failed");
                const data = await response.json();
                latestReportData = data;
                
                // Hide empty state, show panels
                emptyState.style.display = 'none';
                resultsPanel.style.display = 'flex';
                modalityPanel.style.display = 'grid';
                diagnosticPanel.style.display = 'flex';

                // Allow layout to calculate before fading in
                setTimeout(() => {
                    resultsPanel.style.opacity = '1';
                    
                    // Update Verdict Badge dynamically
                    const verdictBadge = document.getElementById('verdict-badge');
                    const verdictIcon = document.getElementById('verdict-icon');
                    const verdictTextEl = document.getElementById('verdict-text');
                    const verdictDesc = document.getElementById('verdict-description');
                    const fraudPercent = data.fraudIndex;
                    
                    if (fraudPercent <= 30) {
                        verdictBadge.style.backgroundColor = 'rgba(78, 222, 163, 0.15)';
                        verdictBadge.style.color = '#4edea3';
                        verdictIcon.textContent = 'verified';
                        verdictTextEl.textContent = '✅ AUTHENTIC — LOW RISK';
                        verdictDesc.textContent = 'Analysis indicates this content is likely authentic and trustworthy.';
                    } else if (fraudPercent <= 60) {
                        verdictBadge.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
                        verdictBadge.style.color = '#f59e0b';
                        verdictIcon.textContent = 'warning';
                        verdictTextEl.textContent = '⚡ MEDIUM RISK — REVIEW RECOMMENDED';
                        verdictDesc.textContent = 'Some indicators suggest potential manipulation. Manual review is advised.';
                    } else {
                        verdictBadge.style.backgroundColor = 'var(--error-container)';
                        verdictBadge.style.color = 'var(--on-error-container)';
                        verdictIcon.textContent = 'report_problem';
                        verdictTextEl.textContent = '🚨 HIGH RISK OF MISINFORMATION';
                        verdictDesc.textContent = 'Deep analysis has detected significant manipulation consistent with misinformation.';
                    }

                    // Update Gauge
                    const gauge = document.getElementById('fraud-gauge');
                    const fraudIndexVal = document.getElementById('fraud-index-val');
                    
                    // Set gauge color based on score
                    if (gauge) {
                        if (fraudPercent <= 30) {
                            gauge.setAttribute('stroke', '#4edea3');
                        } else if (fraudPercent <= 60) {
                            gauge.setAttribute('stroke', '#f59e0b');
                        } else {
                            gauge.setAttribute('stroke', '#ffb4ab');
                        }
                        
                        const offset = 565.48 * (1 - (fraudPercent / 100));
                        gauge.style.strokeDashoffset = offset.toString();
                        
                        // Set value text color
                        if (fraudPercent <= 30) {
                            fraudIndexVal.style.color = '#4edea3';
                        } else if (fraudPercent <= 60) {
                            fraudIndexVal.style.color = '#f59e0b';
                        } else {
                            fraudIndexVal.style.color = 'var(--error)';
                        }

                        // Counter animation for value
                        let current = 0;
                        const timer = setInterval(() => {
                            current += 2;
                            if (current >= fraudPercent) {
                                fraudIndexVal.textContent = fraudPercent + '%';
                                clearInterval(timer);
                            } else {
                                fraudIndexVal.textContent = current + '%';
                            }
                        }, 20);
                    }
                    
                    // Update Modalities
                    document.getElementById('nlp-val').textContent = data.modalityScores.nlp + '% Fake';
                    document.getElementById('nlp-progress').style.width = data.modalityScores.nlp + '%';
                    
                    document.getElementById('cv-val').textContent = data.modalityScores.cv + '% Fake';
                    document.getElementById('cv-progress').style.width = data.modalityScores.cv + '%';
                    
                    document.getElementById('xmodal-val').textContent = data.modalityScores.xmodal + '% Mismatch';
                    document.getElementById('xmodal-progress').style.width = data.modalityScores.xmodal + '%';
                    
                    // Update Diagnostics
                    const listContainer = document.getElementById('diagnostic-list');
                    listContainer.innerHTML = '';
                    
                    data.diagnostics.forEach(diag => {
                        const div = document.createElement('div');
                        div.className = 'diagnostic-item ' + (diag.type === 'success' ? 'success' : '');
                        
                        const iconColorClass = diag.type;
                        const titleColorClass = diag.type === 'error' ? 'text-error' : (diag.type === 'warning' ? 'text-amber' : 'text-primary');

                        div.innerHTML = `
                            <div class="diagnostic-icon ${iconColorClass}">
                                <span class="material-symbols-outlined" style="font-size: 20px;">${diag.icon}</span>
                            </div>
                            <div class="diagnostic-item-content">
                                <h4 class="${titleColorClass}">${diag.title}</h4>
                                <p>${diag.description}</p>
                            </div>
                        `;
                        listContainer.appendChild(div);
                    });

                }, 50); // small delay to ensure display: flex has applied before transition

            } catch (error) {
                console.error("Error:", error);
                alert("An error occurred during verification.");
            } finally {
                // Reset loading state
                submitBtn.style.opacity = '1';
                submitBtn.style.pointerEvents = 'auto';
                submitIcon.textContent = 'search';
                submitText.textContent = 'Run Multimodal Verification';
            }
        });
    }

    // Download Report Logic
    const downloadBtn = document.querySelector('.diagnostic-download');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (!latestReportData) {
                alert("No analysis data available to download yet.");
                return;
            }
            
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(latestReportData, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "verimedia-ai-report.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });
    }

    // Prototype Links Handler
    const inactiveLinks = document.querySelectorAll('a[href="#"]:not([data-type])');
    inactiveLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Highlight the clicked link in header/sidebar if it's one of them
            if (link.classList.contains('header-nav-item')) {
                document.querySelectorAll('.header-nav-item').forEach(n => n.classList.remove('active'));
                link.classList.add('active');
            } else if (link.classList.contains('nav-item')) {
                document.querySelectorAll('.nav-menu .nav-item:not([data-type]), .nav-bottom .nav-item').forEach(n => n.classList.remove('active'));
                link.classList.add('active');
            }

            showToast('This module is coming soon in the full release!');
        });
    });

    function showToast(message) {
        let toast = document.getElementById('prototype-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'prototype-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '24px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'var(--surface-container-high)';
            toast.style.color = 'var(--on-surface)';
            toast.style.padding = '12px 24px';
            toast.style.borderRadius = '8px';
            toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
            toast.style.zIndex = '9999';
            toast.style.fontWeight = '500';
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            toast.style.pointerEvents = 'none';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }

    // New Analysis button logic
    const newAnalysisBtn = document.querySelector('.btn-new-analysis');
    if (newAnalysisBtn) {
        newAnalysisBtn.addEventListener('click', () => {
            // Reset form
            if (verifyForm) verifyForm.reset();
            
            // Reset upload text/icon
            if (uploadText) uploadText.textContent = 'Drag & drop news clip or image here';
            if (uploadIcon) {
                uploadIcon.textContent = 'cloud_upload';
                uploadIcon.style.color = 'var(--on-surface-variant)';
            }
            
            // Hide results, show empty state
            if (emptyState) emptyState.style.display = 'flex';
            if (resultsPanel) {
                resultsPanel.style.display = 'none';
                resultsPanel.style.opacity = '0';
            }
            if (modalityPanel) modalityPanel.style.display = 'none';
            if (diagnosticPanel) diagnosticPanel.style.display = 'none';
            
            // Clear latest report data
            latestReportData = null;
            
            // Switch back to video tab by default
            const videoTab = Array.from(tabs).find(t => t.getAttribute('data-type') === 'video');
            if (videoTab) videoTab.click();
        });
    }

    // History Module Logic
    const historyLink = document.querySelector('a[data-type="history"]');
    const mainDashboard = document.getElementById('main-dashboard');
    const historyDashboard = document.getElementById('history-dashboard');
    const historyListContainer = document.getElementById('history-list-container');

    if (historyLink) {
        historyLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // UI Toggle
            document.querySelectorAll('.nav-menu .nav-item, .nav-bottom .nav-item').forEach(n => n.classList.remove('active'));
            historyLink.classList.add('active');
            
            if (mainDashboard) mainDashboard.style.display = 'none';
            if (settingsDashboard) settingsDashboard.style.display = 'none';
            const docsDashboard = document.getElementById('docs-dashboard');
            if (docsDashboard) docsDashboard.style.display = 'none';
            if (historyDashboard) historyDashboard.style.display = 'flex';
            
            // Fetch history
            try {
                if (historyListContainer) {
                    historyListContainer.innerHTML = '<p class="text-on-surface-variant">Loading history...</p>';
                }
                const response = await fetch('/api/history');
                const data = await response.json();
                
                if (historyListContainer) {
                    historyListContainer.innerHTML = '';
                    
                    if (data.history.length === 0) {
                        historyListContainer.innerHTML = '<p class="text-on-surface-variant">No analysis history found. Run a verification to see it here.</p>';
                        return;
                    }
                    
                    data.history.forEach(item => {
                        const card = document.createElement('div');
                        card.className = 'history-item';
                        
                        let badgeColor = 'var(--error)';
                        let badgeBg = 'var(--error-container)';
                        
                        if (item.fraudIndex <= 30) {
                            badgeColor = '#4edea3';
                            badgeBg = 'rgba(78, 222, 163, 0.15)';
                        } else if (item.fraudIndex <= 60) {
                            badgeColor = '#f59e0b';
                            badgeBg = 'rgba(245, 158, 11, 0.15)';
                        }
                        
                        const date = new Date(item.timestamp).toLocaleString();
                        const typeIcon = item.tabType === 'video' ? 'videocam' : (item.tabType === 'article' ? 'newspaper' : 'share');
                        
                        card.innerHTML = `
                            <div class="history-meta">
                                <div class="history-headline">${item.headline || item.fileName || item.socialUrl || 'Unnamed Analysis'}</div>
                                <div class="history-details">
                                    <span><span class="material-symbols-outlined" style="font-size: 14px; vertical-align: text-bottom;">${typeIcon}</span> ${item.tabType.toUpperCase()}</span>
                                    <span>•</span>
                                    <span>${date}</span>
                                </div>
                            </div>
                            <div class="history-score">
                                <div class="history-badge" style="color: ${badgeColor}; background: ${badgeBg};">
                                    ${item.verdict.replace('_', ' ')}
                                </div>
                                <div style="font-weight: bold; font-size: 18px; color: ${badgeColor};">
                                    ${item.fraudIndex}%
                                </div>
                            </div>
                        `;
                        
                        historyListContainer.appendChild(card);
                    });
                }
            } catch (err) {
                console.error(err);
                if (historyListContainer) {
                    historyListContainer.innerHTML = '<p class="text-error">Failed to load history.</p>';
                }
            }
        });
    }

    // Settings Module Logic
    const settingsLink = document.querySelector('a[data-type="settings"]');
    const settingsDashboard = document.getElementById('settings-dashboard');
    const apiKeyInput = document.getElementById('setting-api-key');
    const tempSlider = document.getElementById('setting-temp');
    const tempValDisplay = document.getElementById('setting-temp-val');
    const saveSettingsBtn = document.getElementById('btn-save-settings');
    const clearHistoryBtn = document.getElementById('btn-clear-history');

    if (settingsLink) {
        settingsLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // UI Toggle
            document.querySelectorAll('.nav-menu .nav-item, .nav-bottom .nav-item').forEach(n => n.classList.remove('active'));
            settingsLink.classList.add('active');
            
            if (mainDashboard) mainDashboard.style.display = 'none';
            if (historyDashboard) historyDashboard.style.display = 'none';
            const docsDashboard = document.getElementById('docs-dashboard');
            if (docsDashboard) docsDashboard.style.display = 'none';
            if (settingsDashboard) settingsDashboard.style.display = 'flex';
            
            // Fetch current settings
            try {
                const res = await fetch('/api/settings');
                const data = await res.json();
                
                if (data.status === 'success') {
                    if (apiKeyInput) apiKeyInput.value = data.apiKey || '';
                    if (tempSlider) {
                        tempSlider.value = data.temperature;
                        if (tempValDisplay) tempValDisplay.textContent = data.temperature;
                    }
                }
            } catch (err) {
                console.error("Failed to load settings:", err);
            }
        });
    }

    // Settings interactions
    if (tempSlider) {
        tempSlider.addEventListener('input', (e) => {
            if (tempValDisplay) tempValDisplay.textContent = e.target.value;
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            const originalText = saveSettingsBtn.textContent;
            saveSettingsBtn.textContent = 'Saving...';
            saveSettingsBtn.style.opacity = '0.7';
            
            try {
                const payload = {
                    apiKey: apiKeyInput ? apiKeyInput.value : undefined,
                    temperature: tempSlider ? tempSlider.value : undefined
                };
                
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const data = await res.json();
                if (data.status === 'success') {
                    saveSettingsBtn.textContent = 'Saved!';
                    saveSettingsBtn.style.backgroundColor = '#4edea3';
                    saveSettingsBtn.style.color = '#000';
                    setTimeout(() => {
                        saveSettingsBtn.textContent = originalText;
                        saveSettingsBtn.style.backgroundColor = '';
                        saveSettingsBtn.style.color = '';
                        saveSettingsBtn.style.opacity = '1';
                    }, 2000);
                }
            } catch (err) {
                console.error("Failed to save settings:", err);
                saveSettingsBtn.textContent = 'Error';
                setTimeout(() => {
                    saveSettingsBtn.textContent = originalText;
                    saveSettingsBtn.style.opacity = '1';
                }, 2000);
            }
        });
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to permanently delete all history?")) {
                const originalText = clearHistoryBtn.textContent;
                clearHistoryBtn.textContent = 'Clearing...';
                
                try {
                    const res = await fetch('/api/history', { method: 'DELETE' });
                    const data = await res.json();
                    
                    if (data.status === 'success') {
                        clearHistoryBtn.textContent = 'Cleared!';
                        setTimeout(() => {
                            clearHistoryBtn.textContent = originalText;
                        }, 2000);
                    }
                } catch (err) {
                    console.error("Failed to clear history:", err);
                    clearHistoryBtn.textContent = 'Error';
                    setTimeout(() => {
                        clearHistoryBtn.textContent = originalText;
                    }, 2000);
                }
            }
        });
    }

    // Documentation Module Logic
    const docsLink = document.querySelector('a[data-type="docs"]');
    const docsDashboard = document.getElementById('docs-dashboard');

    if (docsLink) {
        docsLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            // UI Toggle
            document.querySelectorAll('.nav-menu .nav-item, .nav-bottom .nav-item').forEach(n => n.classList.remove('active'));
            docsLink.classList.add('active');
            
            if (mainDashboard) mainDashboard.style.display = 'none';
            if (historyDashboard) historyDashboard.style.display = 'none';
            if (settingsDashboard) settingsDashboard.style.display = 'none';
            if (docsDashboard) docsDashboard.style.display = 'flex';
        });
    }

    // Ensure returning to other tabs hides history, settings, and docs
    const analysisLinks = document.querySelectorAll('a[data-type="video"], a[data-type="article"], a[data-type="social"]');
    analysisLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (historyDashboard) historyDashboard.style.display = 'none';
            if (settingsDashboard) settingsDashboard.style.display = 'none';
            if (docsDashboard) docsDashboard.style.display = 'none';
            if (mainDashboard) mainDashboard.style.display = 'flex';
        });
    });
});
