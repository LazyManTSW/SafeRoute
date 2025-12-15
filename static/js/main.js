let currentMapLayer = lightLayer;
let currentLabelsLayer = null;
let markerMode = false;
let polygonMode = false;
let polygonPoints = [];
let tempPolygonMarkers = [];
let tempPolygonLines = null;
let selectedColor = '#2196F3';
let selectedIcon = '📍';
let pendingPolygonData = null;
let pendingMarkerData = null;
let savedMarkers = [];
let savedPolygons = [];
let isDeveloperModeActive = false;
let contextMenuTarget = null;
let contextMenuType = null;

const sidePanel = document.getElementById('side-panel');
const closeButton = document.getElementById('close-panel');
const navButtons = document.querySelectorAll('.nav-button[data-panel]');
const panelTitle = document.getElementById('panel-title');
const eventsContent = document.getElementById('events-content');
const settingsContent = document.getElementById('settings-content');
const developerContent = document.getElementById('developer-content');
const changesContent = document.getElementById('changes-content');
const addMarkerBtn = document.getElementById('add-marker-btn');
const addPolygonBtn = document.getElementById('add-polygon-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const polygonFormOverlay = document.getElementById('polygon-form-overlay');
const markerFormOverlay = document.getElementById('marker-form-overlay');
const commentFormOverlay = document.getElementById('comment-form-overlay');
const polygonNameInput = document.getElementById('polygon-name');
const polygonDescriptionInput = document.getElementById('polygon-description');
const markerNameInput = document.getElementById('marker-name');
const markerDescriptionInput = document.getElementById('marker-description');
const markerSourceInput = document.getElementById('marker-source');
const saveCommentInput = document.getElementById('save-comment');
const cancelPolygonBtn = document.getElementById('cancel-polygon-btn');
const savePolygonBtn = document.getElementById('save-polygon-btn');
const cancelMarkerBtn = document.getElementById('cancel-marker-btn');
const saveMarkerBtn = document.getElementById('save-marker-btn');
const cancelSaveBtn = document.getElementById('cancel-save-btn');
const confirmSaveBtn = document.getElementById('confirm-save-btn');
const iconOptions = document.querySelectorAll('.icon-option');
const closePolygonFormBtn = document.getElementById('close-polygon-form');
const closeMarkerFormBtn = document.getElementById('close-marker-form');
const closeCommentFormBtn = document.getElementById('close-comment-form');

function saveSettings() {
    const settings = {
        darkMode: document.body.classList.contains('dark-mode'),
        showMarkers: document.querySelector('.toggle-switch[data-setting="markers"]').classList.contains('active'),
        showPolygons: document.querySelector('.toggle-switch[data-setting="polygon"]').classList.contains('active')
    };
    
    localStorage.setItem('mapSettings', JSON.stringify(settings));
    console.log('Налаштування збережено:', settings);
}


function loadSettings() {
    const savedSettings = localStorage.getItem('mapSettings');
    
    if (!savedSettings) {
        console.log('Збережених налаштувань не знайдено, використовуємо стандартні');
        return;
    }
    
    try {
        const settings = JSON.parse(savedSettings);
        console.log('Налаштування завантажено:', settings);
        
       
        if (settings.darkMode) {
            document.body.classList.add('dark-mode');
            

            map.removeLayer(currentMapLayer);
            if (currentLabelsLayer) {
                map.removeLayer(currentLabelsLayer);
            }
            darkLayer.addTo(map);
            darkLabelsLayer.addTo(map);
            currentMapLayer = darkLayer;
            currentLabelsLayer = darkLabelsLayer;
            
          
            document.querySelector('.toggle-switch[data-setting="dark-mode"]').classList.add('active');
        }
        
       
        const markersToggle = document.querySelector('.toggle-switch[data-setting="markers"]');
        if (settings.showMarkers) {
            markersToggle.classList.add('active');
        } else {
            markersToggle.classList.remove('active');
        }
        
        
        const polygonsToggle = document.querySelector('.toggle-switch[data-setting="polygon"]');
        if (settings.showPolygons) {
            polygonsToggle.classList.add('active');
        } else {
            polygonsToggle.classList.remove('active');
        }
        
    } catch (e) {
        console.error('Помилка при завантаженні налаштувань:', e);
    }
}


function isValidURL(string) {
    if (!string || string.trim() === '') {
        return true;
    }

    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

function showInputError(inputElement, errorElement, errorMessage) {
    inputElement.classList.add('error');
    inputElement.classList.remove('input-valid');
    errorElement.textContent = errorMessage || errorElement.textContent;
    errorElement.classList.add('active');
}

function hideInputError(inputElement, errorElement) {
    inputElement.classList.remove('error');
    errorElement.classList.remove('active');
}

function showInputValid(inputElement) {
    inputElement.classList.remove('error');
    inputElement.classList.add('input-valid');
}

const sourceError = document.getElementById('source-error');

markerSourceInput.addEventListener('input', () => {
    const value = markerSourceInput.value.trim();

    if (value === '') {
        hideInputError(markerSourceInput, sourceError);
        return;
    }

    if (isValidURL(value)) {
        hideInputError(markerSourceInput, sourceError);
        showInputValid(markerSourceInput);
    } else {
        showInputError(markerSourceInput, sourceError, '⚠️ Введіть правильне посилання (наприклад: https://example.com)');
    }
});

markerSourceInput.addEventListener('blur', () => {
    if (markerSourceInput.value.trim() === '') {
        hideInputError(markerSourceInput, sourceError);
        markerSourceInput.classList.remove('input-valid');
    }
});

closeButton.addEventListener('click', () => {
    sidePanel.classList.add('hidden');
    navButtons.forEach(btn => btn.classList.remove('active'));
    isDeveloperModeActive = false;
    toggleMarkersDraggable(false);
    toggleAddButtons(false);
});

function toggleAddButtons(show) {
    const addMarkerBtn = document.getElementById('add-marker-btn');
    const addPolygonBtn = document.getElementById('add-polygon-btn');
    const polygonHints = document.getElementById('polygon-hints');

    if (show) {
        addMarkerBtn.style.display = 'flex';
        addPolygonBtn.style.display = 'flex';
    } else {
        addMarkerBtn.style.display = 'none';
        addPolygonBtn.style.display = 'none';
        polygonHints.classList.remove('active');

        markerMode = false;
        polygonMode = false;
        addMarkerBtn.classList.remove('active');
        addPolygonBtn.classList.remove('active');
        map.getContainer().style.cursor = '';
        clearTempPolygon();
    }
}

const toggleSwitches = document.querySelectorAll('.toggle-switch');
toggleSwitches.forEach(toggle => {
    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        const setting = toggle.dataset.setting;
        const isActive = toggle.classList.contains('active');

        if (setting === 'dark-mode') {
            document.body.classList.toggle('dark-mode');

            const isDark = document.body.classList.contains('dark-mode');

            if (isDark) {
                map.removeLayer(currentMapLayer);
                if (currentLabelsLayer) {
                    map.removeLayer(currentLabelsLayer);
                }
                darkLayer.addTo(map);
                darkLabelsLayer.addTo(map);
                currentMapLayer = darkLayer;
                currentLabelsLayer = darkLabelsLayer;
            } else {
                map.removeLayer(currentMapLayer);
                if (currentLabelsLayer) {
                    map.removeLayer(currentLabelsLayer);
                }
                lightLayer.addTo(map);
                currentMapLayer = lightLayer;
                currentLabelsLayer = null;
            }
        } else if (setting === 'markers') {
            savedMarkers.forEach(marker => {
                if (isActive) {
                    if (!map.hasLayer(marker)) {
                        marker.addTo(map);
                    }
                } else {
                    if (map.hasLayer(marker)) {
                        map.removeLayer(marker);
                    }
                }
            });
        } else if (setting === 'polygon') {
            savedPolygons.forEach(polygon => {
                if (isActive) {
                    if (!map.hasLayer(polygon)) {
                        polygon.addTo(map);
                    }
                } else {
                    if (map.hasLayer(polygon)) {
                        map.removeLayer(polygon);
                    }
                }
            });
        }
        
        // ДОДАНО: Зберігаємо налаштування після кожної зміни
        saveSettings();
    });
});

polygonFormOverlay.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', () => {
        polygonFormOverlay.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedColor = option.dataset.color;

        if (pendingPolygonData) {
            pendingPolygonData.color = selectedColor;

            if (tempPolygonLines) {
                map.removeLayer(tempPolygonLines);
                tempPolygonLines = L.polygon(polygonPoints, {
                    color: selectedColor,
                    fillColor: selectedColor,
                    fillOpacity: 0.2,
                    weight: 2,
                    dashArray: '5, 5'
                }).addTo(map);
            }
        }
    });
});

markerFormOverlay.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', () => {
        markerFormOverlay.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedColor = option.dataset.color;

        if (pendingMarkerData) {
            pendingMarkerData.color = selectedColor;
        }
    });
});

iconOptions.forEach(option => {
    option.addEventListener('click', () => {
        iconOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedIcon = option.dataset.icon;

        if (pendingMarkerData) {
            pendingMarkerData.icon = selectedIcon;
        }
    });
});

addMarkerBtn.addEventListener('click', () => {
    markerMode = !markerMode;
    polygonMode = false;

    addMarkerBtn.classList.toggle('active', markerMode);
    addPolygonBtn.classList.remove('active');

    if (!polygonMode) {
        clearTempPolygon();
    }

    if (markerMode) {
        map.getContainer().style.cursor = 'crosshair';
    } else {
        map.getContainer().style.cursor = '';
    }
});

const polygonHints = document.getElementById('polygon-hints');
const closeHintsBtn = document.getElementById('close-hints');

addPolygonBtn.addEventListener('click', () => {
    polygonMode = !polygonMode;
    markerMode = false;

    addPolygonBtn.classList.toggle('active', polygonMode);
    addMarkerBtn.classList.remove('active');

    if (!polygonMode) {
        clearTempPolygon();
        polygonHints.classList.remove('active');
    } else {
        polygonHints.classList.add('active');
    }

    if (polygonMode) {
        map.getContainer().style.cursor = 'crosshair';
    } else {
        map.getContainer().style.cursor = '';
        clearTempPolygon();
    }
});

closeHintsBtn.addEventListener('click', () => {
    polygonHints.classList.remove('active');
});

zoomInBtn.addEventListener('click', () => map.zoomIn());
zoomOutBtn.addEventListener('click', () => map.zoomOut());

function clearTempPolygon() {
    polygonPoints = [];
    tempPolygonMarkers.forEach(marker => map.removeLayer(marker));
    tempPolygonMarkers = [];
    if (tempPolygonLines) {
        map.removeLayer(tempPolygonLines);
        tempPolygonLines = null;
    }
}

function createCustomIcon(icon, color) {
    return L.divIcon({
        className: 'custom-marker-icon',
        html: `<div style="background-color: ${color}; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${icon}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });
}

function showContextMenu(e, type, item) {
    if (!isDeveloperModeActive) {
        return;
    }

    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();

    const contextMenu = document.getElementById('context-menu');
    contextMenuTarget = item;
    contextMenuType = type;

    const x = e.originalEvent.pageX;
    const y = e.originalEvent.pageY;

    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.style.display = 'block';
}

document.getElementById('context-edit').addEventListener('click', () => {
    const contextMenu = document.getElementById('context-menu');
    contextMenu.style.display = 'none';

    if (contextMenuType === 'marker') {
        editMarker(contextMenuTarget.options.dbId);
    } else if (contextMenuType === 'polygon') {
        editPolygon(contextMenuTarget.options.dbId);
    }
});

document.getElementById('context-delete').addEventListener('click', () => {
    const contextMenu = document.getElementById('context-menu');
    contextMenu.style.display = 'none';

    const itemName = contextMenuType === 'marker' ? 'маркер' : 'полігон';
    if (confirm(`Видалити ${itemName}?`)) {
        if (contextMenuType === 'marker') {
            deleteMarker(contextMenuTarget.options.dbId);
        } else if (contextMenuType === 'polygon') {
            deletePolygon(contextMenuTarget.options.dbId);
        }
    }
});

document.addEventListener('click', (e) => {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu.contains(e.target)) {
        contextMenu.style.display = 'none';
    }
});

document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('#map') && !e.target.closest('.leaflet-marker-icon') && !e.target.closest('.leaflet-interactive')) {
        document.getElementById('context-menu').style.display = 'none';
    }
});

map.on('click', (e) => {
    if (markerMode) {
        pendingMarkerData = {
            latlng: e.latlng,
            icon: selectedIcon,
            color: selectedColor
        };

        markerFormOverlay.classList.add('active');
        markerNameInput.value = '';
        markerDescriptionInput.value = '';
        markerSourceInput.value = '';

        markerSourceInput.classList.remove('error', 'input-valid');
        hideInputError(markerSourceInput, sourceError);

        markerFormOverlay.querySelectorAll('.color-option').forEach(opt => {
            if (opt.dataset.color === selectedColor) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });

        iconOptions.forEach(opt => {
            if (opt.dataset.icon === selectedIcon) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });

        markerNameInput.focus();

    } else if (polygonMode) {
        let clickedOnMarker = false;
        tempPolygonMarkers.forEach(marker => {
            const markerLatLng = marker.getLatLng();
            const distance = map.distance(e.latlng, markerLatLng);
            if (distance < 10) {
                clickedOnMarker = true;
            }
        });

        if (clickedOnMarker) {
            return;
        }

        const pointIndex = polygonPoints.length;
        polygonPoints.push([e.latlng.lat, e.latlng.lng]);

        const tempMarker = L.circleMarker([e.latlng.lat, e.latlng.lng], {
            radius: 6,
            color: '#2196F3',
            fillColor: '#fff',
            fillOpacity: 1,
            weight: 3
        }).addTo(map);

        let isDragging = false;

        tempMarker.on('mousedown', function(evt) {
            L.DomEvent.stopPropagation(evt);

            isDragging = false;
            const markerIndex = tempPolygonMarkers.indexOf(tempMarker);

            map.dragging.disable();

            const onMouseMove = function(evt) {
                isDragging = true;
                const newLatLng = evt.latlng;
                tempMarker.setLatLng(newLatLng);
                polygonPoints[markerIndex] = [newLatLng.lat, newLatLng.lng];

                if (polygonPoints.length > 1) {
                    if (tempPolygonLines) {
                        map.removeLayer(tempPolygonLines);
                    }
                    tempPolygonLines = L.polygon(polygonPoints, {
                        color: selectedColor,
                        fillColor: selectedColor,
                        fillOpacity: 0.2,
                        weight: 2,
                        dashArray: '5, 5'
                    }).addTo(map);
                }
            };

            const onMouseUp = function() {
                map.dragging.enable();
                map.off('mousemove', onMouseMove);
                map.off('mouseup', onMouseUp);

                setTimeout(() => {
                    isDragging = false;
                }, 100);
            };

            map.on('mousemove', onMouseMove);
            map.on('mouseup', onMouseUp);
        });

        tempMarker.on('click', function(evt) {
            L.DomEvent.stopPropagation(evt);
        });

        tempPolygonMarkers.push(tempMarker);

        if (polygonPoints.length > 1) {
            if (tempPolygonLines) {
                map.removeLayer(tempPolygonLines);
            }

            tempPolygonLines = L.polygon(polygonPoints, {
                color: selectedColor,
                fillColor: selectedColor,
                fillOpacity: 0.2,
                weight: 2,
                dashArray: '5, 5'
            }).addTo(map);
        }
    }
});

cancelPolygonBtn.addEventListener('click', () => {
    polygonFormOverlay.classList.remove('active');
    clearTempPolygon();
    pendingPolygonData = null;
    polygonMode = false;
    addPolygonBtn.classList.remove('active');
    polygonHints.classList.remove('active');
    map.getContainer().style.cursor = '';
});

closePolygonFormBtn.addEventListener('click', () => {
    cancelPolygonBtn.click();
});

cancelMarkerBtn.addEventListener('click', () => {
    markerFormOverlay.classList.remove('active');
    pendingMarkerData = null;
    markerMode = false;
    addMarkerBtn.classList.remove('active');
    map.getContainer().style.cursor = '';
});

closeMarkerFormBtn.addEventListener('click', () => {
    cancelMarkerBtn.click();
});

polygonFormOverlay.addEventListener('dblclick', (e) => {
    if (e.target === polygonFormOverlay) {
        cancelPolygonBtn.click();
    }
});

markerFormOverlay.addEventListener('dblclick', (e) => {
    if (e.target === markerFormOverlay) {
        cancelMarkerBtn.click();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z' && polygonMode && polygonPoints.length > 0) {
        e.preventDefault();

        polygonPoints.pop();

        if (tempPolygonMarkers.length > 0) {
            const lastMarker = tempPolygonMarkers.pop();
            map.removeLayer(lastMarker);
        }

        if (tempPolygonLines) {
            map.removeLayer(tempPolygonLines);
            tempPolygonLines = null;
        }

        if (polygonPoints.length >= 2) {
            tempPolygonLines = L.polygon(polygonPoints, {
                color: selectedColor,
                fillColor: selectedColor,
                fillOpacity: 0.2,
                weight: 2,
                dashArray: '5, 5'
            }).addTo(map);
        }
    }
    
    else if (e.key === 'Enter' && polygonMode && polygonPoints.length >= 3) {
        e.preventDefault();

        pendingPolygonData = {
            points: [...polygonPoints],
            color: selectedColor
        };

        polygonFormOverlay.classList.add('active');
        polygonNameInput.value = '';
        polygonDescriptionInput.value = '';

        polygonFormOverlay.querySelectorAll('.color-option').forEach(opt => {
            if (opt.dataset.color === selectedColor) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });

        polygonNameInput.focus();
    }

    else if (e.key === 'Escape') {
        if (polygonFormOverlay.classList.contains('active')) {
            e.preventDefault();
            cancelPolygonBtn.click();
        } else if (markerFormOverlay.classList.contains('active')) {
            e.preventDefault();
            cancelMarkerBtn.click();
        } else if (polygonMode) {
            e.preventDefault();
            clearTempPolygon();
            polygonMode = false;
            addPolygonBtn.classList.remove('active');
            polygonHints.classList.remove('active');
            map.getContainer().style.cursor = '';
        } else if (markerMode) {
            e.preventDefault();
            markerMode = false;
            addMarkerBtn.classList.remove('active');
            map.getContainer().style.cursor = '';
        }
    }
});

polygonNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        savePolygonBtn.click();
    }
});

markerNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        saveMarkerBtn.click();
    }
});

async function addMarkerToDatabase(markerData) {
    try {
        const response = await fetch('/api/add-marker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(markerData)
        });
        const result = await response.json();
        return result.success ? result.id : null;
    } catch (error) {
        console.error('Error adding marker:', error);
        return null;
    }
}

async function addPolygonToDatabase(polygonData) {
    try {
        const response = await fetch('/api/add-polygon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(polygonData)
        });
        const result = await response.json();
        return result.success ? result.id : null;
    } catch (error) {
        console.error('Error adding polygon:', error);
        return null;
    }
}

async function deleteMarker(markerId) {
    try {
        const response = await fetch(`/api/delete-marker/${markerId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
            const markerIndex = savedMarkers.findIndex(m => m.options.dbId === markerId);
            if (markerIndex !== -1) {
                map.removeLayer(savedMarkers[markerIndex]);
                savedMarkers.splice(markerIndex, 1);
            }
            updateDeveloperPanel();
            loadEventsFromMarkers();
        }
    } catch (error) {
        console.error('Error deleting marker:', error);
    }
}

async function deletePolygon(polygonId) {
    try {
        const response = await fetch(`/api/delete-polygon/${polygonId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
            const polygonIndex = savedPolygons.findIndex(p => p.options.dbId === polygonId);
            if (polygonIndex !== -1) {
                map.removeLayer(savedPolygons[polygonIndex]);
                savedPolygons.splice(polygonIndex, 1);
            }
            updateDeveloperPanel();
        }
    } catch (error) {
        console.error('Error deleting polygon:', error);
    }
}

function updateDeveloperPanel() {
    const markersList = document.getElementById('markers-list');
    const polygonsList = document.getElementById('polygons-list');

    if (savedMarkers.length === 0) {
        markersList.innerHTML = '<div class="empty-list">Немає маркерів</div>';
    } else {
        markersList.innerHTML = savedMarkers.map(marker => {
            const opts = marker.options;
            return `
                <div class="dev-item">
                    <div class="dev-item-header">
                        <div class="dev-item-title">${opts.customIcon || '📍'} ${opts.title || 'Untitled'}</div>
                        <div class="dev-item-actions">
                            <button class="dev-btn dev-btn-edit" data-marker-id="${opts.dbId}">✏️</button>
                            <button class="dev-btn dev-btn-delete" data-marker-id="${opts.dbId}">🗑️</button>
                        </div>
                    </div>
                    <div class="dev-item-info">
                        Coordinates: ${marker.getLatLng().lat.toFixed(6)}, ${marker.getLatLng().lng.toFixed(6)}<br>
                        Color: <span style="display:inline-block;width:12px;height:12px;background:${opts.customColor};border-radius:2px;"></span>
                    </div>
                </div>
            `;
        }).join('');

        markersList.querySelectorAll('.dev-btn-edit[data-marker-id]').forEach(btn => {
            btn.addEventListener('click', () => editMarker(btn.dataset.markerId));
        });
        markersList.querySelectorAll('.dev-btn-delete[data-marker-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Видалити маркер?')) deleteMarker(btn.dataset.markerId);
            });
        });
    }

    if (savedPolygons.length === 0) {
        polygonsList.innerHTML = '<div class="empty-list">Немає полігонів</div>';
    } else {
        polygonsList.innerHTML = savedPolygons.map(polygon => {
            const opts = polygon.options;
            const points = polygon.getLatLngs()[0];
            return `
                <div class="dev-item">
                    <div class="dev-item-header">
                        <div class="dev-item-title">⬡ ${opts.title || 'Untitled'}</div>
                        <div class="dev-item-actions">
                            <button class="dev-btn dev-btn-edit" data-polygon-id="${opts.dbId}">✏️</button>
                            <button class="dev-btn dev-btn-delete" data-polygon-id="${opts.dbId}">🗑️</button>
                        </div>
                    </div>
                    <div class="dev-item-info">
                        Points: ${points.length}<br>
                        Color: <span style="display:inline-block;width:12px;height:12px;background:${opts.color};border-radius:2px;"></span>
                    </div>
                </div>
            `;
        }).join('');

        polygonsList.querySelectorAll('.dev-btn-edit[data-polygon-id]').forEach(btn => {
            btn.addEventListener('click', () => editPolygon(btn.dataset.polygonId));
        });
        polygonsList.querySelectorAll('.dev-btn-delete[data-polygon-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Видалити полігон?')) deletePolygon(btn.dataset.polygonId);
            });
        });
    }
}

function editMarker(markerId) {
    const marker = savedMarkers.find(m => m.options.dbId === markerId);
    if (!marker) return;

    const opts = marker.options;
    pendingMarkerData = {
        latlng: marker.getLatLng(),
        icon: opts.customIcon,
        color: opts.customColor,
        isEdit: true,
        markerId: markerId,
        marker: marker
    };

    markerFormOverlay.classList.add('active');
    markerNameInput.value = opts.title || '';
    markerDescriptionInput.value = opts.description || '';
    markerSourceInput.value = opts.source || '';

    markerFormOverlay.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === opts.customColor);
    });

    iconOptions.forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.icon === opts.customIcon);
    });

    selectedColor = opts.customColor;
    selectedIcon = opts.customIcon;

    document.querySelector('.marker-form h2').textContent = 'Edit Marker';
}

function editPolygon(polygonId) {
    const polygon = savedPolygons.find(p => p.options.dbId === polygonId);
    if (!polygon) return;

    const opts = polygon.options;
    const points = polygon.getLatLngs()[0].map(ll => [ll.lat, ll.lng]);

    pendingPolygonData = {
        points: points,
        color: opts.color,
        isEdit: true,
        polygonId: polygonId,
        polygon: polygon
    };

    polygonFormOverlay.classList.add('active');
    polygonNameInput.value = opts.title || '';
    polygonDescriptionInput.value = opts.description || '';

    polygonFormOverlay.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === opts.color);
    });

    selectedColor = opts.color;

    document.querySelector('.polygon-form h2').textContent = 'Edit Polygon';
}

function toggleMarkersDraggable(enabled) {
    savedMarkers.forEach(marker => {
        if (enabled) {
            marker.dragging.enable();
        } else {
            marker.dragging.disable();
        }
    });
}

saveMarkerBtn.onclick = async function() {
    const name = markerNameInput.value.trim();
    const source = markerSourceInput.value.trim();

    hideInputError(markerSourceInput, sourceError);

    if (!name) {
        markerNameInput.focus();
        return;
    }

    if (source && !isValidURL(source)) {
        showInputError(markerSourceInput, sourceError, '⚠️ Введіть правильне посилання (наприклад: https://example.com)');
        markerSourceInput.focus();
        return;
    }

    if (pendingMarkerData) {
        const description = markerDescriptionInput.value.trim();

        const markerData = {
            lat: pendingMarkerData.latlng.lat,
            lng: pendingMarkerData.latlng.lng,
            name: name,
            description: description,
            source: source,
            icon: pendingMarkerData.icon,
            color: pendingMarkerData.color
        };

        if (pendingMarkerData.isEdit) {
            const response = await fetch(`/api/update-marker/${pendingMarkerData.markerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(markerData)
            });

            const result = await response.json();
            if (result.success) {
                const marker = pendingMarkerData.marker;
                marker.options.title = name;
                marker.options.description = description;
                marker.options.source = source;
                marker.options.customIcon = pendingMarkerData.icon;
                marker.options.customColor = pendingMarkerData.color;

                const customIcon = createCustomIcon(pendingMarkerData.icon, pendingMarkerData.color);
                marker.setIcon(customIcon);

                let popupContent = `<b>${name}</b><br>`;
                if (description) popupContent += `${description}<br>`;
                if (source) popupContent += `<a href="${source}" target="_blank">🔗 Source</a><br>`;
                popupContent += `<small>Icon: ${pendingMarkerData.icon} | Color: <span style="display:inline-block;width:12px;height:12px;background:${pendingMarkerData.color};border-radius:2px;"></span></small>`;
                marker.setPopupContent(popupContent);

                updateDeveloperPanel();
                loadEventsFromMarkers();
            }
        } else {
            const dbId = await addMarkerToDatabase(markerData);
            if (dbId) {
                const customIcon = createCustomIcon(pendingMarkerData.icon, pendingMarkerData.color);
                const marker = L.marker([pendingMarkerData.latlng.lat, pendingMarkerData.latlng.lng], {
                    icon: customIcon,
                    draggable: false,
                    title: name,
                    description: description,
                    source: source,
                    customIcon: pendingMarkerData.icon,
                    customColor: pendingMarkerData.color,
                    dbId: dbId
                }).addTo(map);
                marker.on('click', () => {
                    const eventsButton = document.querySelector('.nav-button[data-panel="events"]');
                    if (!eventsButton.classList.contains('active')) {
                        eventsButton.click();
                    }
                    
                    setTimeout(() => {
                        const eventCard = document.querySelector(`.event-card[data-marker-id="${dbId}"]`);
                        if (eventCard) {
                            eventCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            eventCard.classList.add('highlight');
                            
                            setTimeout(() => {
                                eventCard.classList.remove('highlight');
                            }, 2000);
                        }
                    }, 100);
                });
                let popupContent = `<b>${name}</b><br>`;
                if (description) popupContent += `${description}<br>`;
                if (source) popupContent += `<a href="${source}" target="_blank">🔗 Source</a><br>`;
                popupContent += `<small>Icon: ${pendingMarkerData.icon} | Color: <span style="display:inline-block;width:12px;height:12px;background:${pendingMarkerData.color};border-radius:2px;"></span></small>`;
                marker.bindPopup(popupContent);

                savedMarkers.push(marker);
                updateDeveloperPanel();

                const eventsPanel = document.getElementById('events-content');
                if (eventsPanel.classList.contains('active')) {
                    loadEventsFromMarkers();
                }
            }
        }

        markerFormOverlay.classList.remove('active');
        document.querySelector('.marker-form h2').textContent = 'Marker Settings';
        pendingMarkerData = null;
        markerMode = false;
        addMarkerBtn.classList.remove('active');
        map.getContainer().style.cursor = '';

        markerNameInput.value = '';
        markerDescriptionInput.value = '';
        markerSourceInput.value = '';
        markerSourceInput.classList.remove('input-valid');
        hideInputError(markerSourceInput, sourceError);
    }
};

savePolygonBtn.onclick = async function() {
    const name = polygonNameInput.value.trim();
    if (!name) {
        return;
    }

    if (pendingPolygonData) {
        const description = polygonDescriptionInput.value.trim();
        const polygonData = {
            points: pendingPolygonData.points,
            name: name,
            description: description,
            color: pendingPolygonData.color
        };

        if (pendingPolygonData.isEdit) {
            const response = await fetch(`/api/update-polygon/${pendingPolygonData.polygonId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(polygonData)
            });

            const result = await response.json();
            if (result.success) {
                const polygon = pendingPolygonData.polygon;
                polygon.options.title = name;
                polygon.options.description = description;
                polygon.setStyle({
                    color: pendingPolygonData.color,
                    fillColor: pendingPolygonData.color
                });

                let popupContent = `<b>${name}</b><br>`;
                if (description) popupContent += `${description}<br>`;
                popupContent += `<small>Color: <span style="display:inline-block;width:12px;height:12px;background:${pendingPolygonData.color};border-radius:2px;"></span></small>`;
                polygon.setPopupContent(popupContent);

                updateDeveloperPanel();
            }
        } else {
            const dbId = await addPolygonToDatabase(polygonData);
            if (dbId) {
                const polygon = L.polygon(pendingPolygonData.points, {
                    color: pendingPolygonData.color,
                    fillColor: pendingPolygonData.color,
                    fillOpacity: 0.3,
                    weight: 2,
                    title: name,
                    description: description,
                    dbId: dbId
                }).addTo(map);

                polygon.on('contextmenu', (e) => {
                    showContextMenu(e, 'polygon', polygon);
                });

                let popupContent = `<b>${name}</b><br>`;
                if (description) popupContent += `${description}<br>`;
                popupContent += `<small>Color: <span style="display:inline-block;width:12px;height:12px;background:${pendingPolygonData.color};border-radius:2px;"></span></small>`;
                polygon.bindPopup(popupContent);

                savedPolygons.push(polygon);
                updateDeveloperPanel();
            }
        }

        polygonFormOverlay.classList.remove('active');
        document.querySelector('.polygon-form h2').textContent = 'Polygon Settings';
        clearTempPolygon();
        pendingPolygonData = null;
        polygonMode = false;
        addPolygonBtn.classList.remove('active');
        map.getContainer().style.cursor = '';
    }
};

navButtons.forEach(button => {
    button.addEventListener('click', () => {
        const panelType = button.dataset.panel;

        if (button.classList.contains('active')) {
            sidePanel.classList.add('hidden');
            button.classList.remove('active');
            if (panelType === 'developer') {
                isDeveloperModeActive = false;
                toggleMarkersDraggable(false);
                toggleAddButtons(false);
            }
        } else {
            sidePanel.classList.remove('hidden');
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            eventsContent.classList.remove('active');
            settingsContent.classList.remove('active');
            developerContent.classList.remove('active');
            changesContent.classList.remove('active');

            if (panelType === 'events') {
                panelTitle.textContent = 'Події';
                eventsContent.classList.add('active');
                isDeveloperModeActive = false;
                toggleMarkersDraggable(false);
                toggleAddButtons(false);
                loadEventsFromMarkers();
            } else if (panelType === 'settings') {
                panelTitle.textContent = 'Налаштування';
                settingsContent.classList.add('active');
                isDeveloperModeActive = false;
                toggleMarkersDraggable(false);
                toggleAddButtons(false);
            } else if (panelType === 'developer') {
                panelTitle.textContent = 'Розробник';
                developerContent.classList.add('active');
                isDeveloperModeActive = true;
                toggleMarkersDraggable(true);
                toggleAddButtons(true);
                updateDeveloperPanel();
            } else if (panelType === 'changes') {
                panelTitle.textContent = 'Зміни';
                changesContent.classList.add('active');
                isDeveloperModeActive = false;
                toggleMarkersDraggable(false);
                toggleAddButtons(false);
                loadChangesHistory();
            }
        }
    });
});

async function saveMap() {
    const comment = saveCommentInput.value.trim();
    if (!comment) {
        return;
    }

    try {
        const response = await fetch('/api/save-map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'default',
                comment: comment
            })
        });
        const result = await response.json();
        if (result.success) {
            commentFormOverlay.classList.remove('active');
            saveCommentInput.value = '';
            loadChangesHistory();
        } else {
            console.error('Save error:', result.error);
        }
    } catch (error) {
        console.error('Save error:', error);
    }
}

function showSaveCommentForm() {
    commentFormOverlay.classList.add('active');
    saveCommentInput.value = '';
    saveCommentInput.focus();
}

function clearAllMapElements() {
    savedMarkers.forEach(m => {
        try {
            map.removeLayer(m);
        } catch (e) {
            console.warn('Error removing marker:', e);
        }
    });
    savedMarkers = [];

    savedPolygons.forEach(p => {
        try {
            map.removeLayer(p);
        } catch (e) {
            console.warn('Error removing polygon:', e);
        }
    });
    savedPolygons = [];

    map.eachLayer(function(layer) {
        if (layer !== currentMapLayer && layer !== currentLabelsLayer && layer !== lightLayer && layer !== darkLayer && layer !== darkLabelsLayer) {
            try {
                map.removeLayer(layer);
            } catch (e) {
                console.warn('Error removing layer:', e);
            }
        }
    });
}

async function loadMap() {
    try {
        const response = await fetch('/api/load-map?name=default');
        const result = await response.json();

        if (!result.success) {
            clearAllMapElements();
            return;
        }

        clearAllMapElements();

        const mapData = result.data;

        const markersToggle = document.querySelector('.toggle-switch[data-setting="markers"]');
        const polygonsToggle = document.querySelector('.toggle-switch[data-setting="polygon"]');
        const showMarkers = markersToggle ? markersToggle.classList.contains('active') : true;
        const showPolygons = polygonsToggle ? polygonsToggle.classList.contains('active') : false;

        mapData.markers.forEach(m => {
            const customIcon = createCustomIcon(m.icon, m.color);
            const marker = L.marker([m.lat, m.lng], {
                icon: customIcon,
                draggable: false,
                title: m.name,
                description: m.description,
                source: m.source,
                customIcon: m.icon,
                customColor: m.color,
                dbId: m.id
            });

            if (showMarkers) {
                marker.addTo(map);
            }

            marker.on('contextmenu', (e) => {
                showContextMenu(e, 'marker', marker);
            });
            marker.on('click', () => {
                // Відкриваємо панель подій
                const eventsButton = document.querySelector('.nav-button[data-panel="events"]');
                if (!eventsButton.classList.contains('active')) {
                    eventsButton.click();
                }
                
                // Знаходимо відповідну картку події і підсвічуємо її
                setTimeout(() => {
                    const eventCard = document.querySelector(`.event-card[data-marker-id="${m.id}"]`);
                    if (eventCard) {
                        eventCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        eventCard.classList.add('highlight');
                        
                        setTimeout(() => {
                            eventCard.classList.remove('highlight');
                        }, 2000);
                    }
                }, 100);
            });
            
            let popupContent = `<b>${m.name}</b><br>`;
            if (m.description) popupContent += `${m.description}<br>`;
            if (m.source) popupContent += `<a href="${m.source}" target="_blank">🔗 Source</a><br>`;
            popupContent += `<small>Icon: ${m.icon} | Color: <span style="display:inline-block;width:12px;height:12px;background:${m.color};border-radius:2px;"></span></small>`;
            marker.bindPopup(popupContent);

            savedMarkers.push(marker);
        });

        mapData.polygons.forEach(p => {
            const polygon = L.polygon(p.points, {
                color: p.color,
                fillColor: p.color,
                fillOpacity: 0.3,
                weight: 2,
                title: p.name,
                description: p.description,
                dbId: p.id
            });

            if (showPolygons) {
                polygon.addTo(map);
            }

            polygon.on('contextmenu', (e) => {
                showContextMenu(e, 'polygon', polygon);
            });

            let popupContent = `<b>${p.name}</b><br>`;
            if (p.description) popupContent += `${p.description}<br>`;
            popupContent += `<small>Color: <span style="display:inline-block;width:12px;height:12px;background:${p.color};border-radius:2px;"></span></small>`;
            polygon.bindPopup(popupContent);

            savedPolygons.push(polygon);
        });

        updateDeveloperPanel();
        loadEventsFromMarkers();
    } catch (error) {
        console.error('Load error:', error);
    }
}

async function loadChangesHistory() {
    try {
        const response = await fetch('/api/get-changes-history?name=default');
        const result = await response.json();

        const changesList = document.getElementById('changes-list');

        if (!result.success) {
            console.error('Error:', result.error);
            changesList.innerHTML = '<div class="empty-list">Помилка: ' + (result.error || 'Невідома помилка') + '</div>';
            return;
        }

        if (!result.versions || result.versions.length === 0) {
            changesList.innerHTML = '<div class="empty-list">Немає історії змін. Збережіть карту, щоб створити першу версію.</div>';
            return;
        }

        changesList.innerHTML = result.versions.map((version, index) => {
            const date = new Date(version.timestamp);

            if (isNaN(date.getTime())) {
                console.error('Invalid timestamp:', version.timestamp);
                return `<div class="empty-list">Помилка розбору дати для версії ${index + 1}</div>`;
            }

            const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            const isCurrent = index === 0;

            return `
                <div class="version-card ${isCurrent ? 'current' : ''}">
                    <div class="version-header">
                        <div class="version-info">
                            <div class="version-title">
                                ${isCurrent ? '🟢 ' : ''}Версія #${result.versions.length - index}
                                ${isCurrent ? '<span class="current-badge">Поточна</span>' : ''}
                            </div>
                            <div class="version-date">${formattedDate}</div>
                        </div>
                        ${!isCurrent ? `
                            <button class="form-button secondary version-restore-btn" data-filename="${version.filename}">
                                ↩️ Відновити до цієї версії
                            </button>
                        ` : ''}
                    </div>
                    <div class="version-comment">${version.comment}</div>
                    <div class="version-stats">
                        📍 Markers: ${version.markers_count} | ⬡ Polygons: ${version.polygons_count}
                    </div>
                </div>
            `;
        }).join('');

        changesList.querySelectorAll('.version-restore-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filename = btn.dataset.filename;
                if (confirm('⚠️ Відновити карту до цієї версії?\n\nПоточні зміни будуть збережені як нова версія.')) {
                    restoreVersion(filename);
                }
            });
        });

    } catch (error) {
        console.error('Load history error:', error);
        document.getElementById('changes-list').innerHTML = '<div class="empty-list">Помилка завантаження історії: ' + error.message + '</div>';
    }
}

async function restoreVersion(filename) {
    try {
        const response = await fetch('/api/restore-version', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'default',
                filename: filename
            })
        });
        const result = await response.json();

        if (result.success) {
            await loadMap();

            loadChangesHistory();
        } else {
            console.error('Restore error:', result.error);
        }
    } catch (error) {
        console.error('Restore error:', error);
    }
}

function addEventToList(eventData) {
    const eventsListContainer = document.querySelector('.events-list');

    const eventCard = document.createElement('div');
    eventCard.className = 'event-card';
    eventCard.dataset.markerId = eventData.markerId;

    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const sourceLink = eventData.source
        ? `<a href="${eventData.source}" target="_blank" class="event-location">📍 Source</a>`
        : '<span class="event-location">📍 No source</span>';

    const backgroundColor = eventData.color || '#2196F3';

    const coordinates = eventData.coordinates 
        ? `<div class="event-coordinates">📍 ${eventData.coordinates.lat.toFixed(6)}, ${eventData.coordinates.lng.toFixed(6)}</div>`
        : '';

    eventCard.innerHTML = `
        <div class="event-header">
            <div class="event-icon" style="background-color: ${backgroundColor};">${eventData.icon || 'ℹ️'}</div>
            <div class="event-content">
                <div class="event-title">${eventData.name}</div>
                <div class="event-text">${eventData.description || 'No description'}</div>
                <div class="event-meta">
                    ${sourceLink}
                </div>
                ${coordinates}
                <div class="event-updated">Updated ${formattedDate}</div>
            </div>
        </div>
    `;

    eventsListContainer.insertBefore(eventCard, eventsListContainer.firstChild);
}

function loadEventsFromMarkers() {
    const eventsListContainer = document.querySelector('.events-list');
    eventsListContainer.innerHTML = '';

    if (savedMarkers.length === 0) {
        eventsListContainer.innerHTML = '<div class="empty-events-message">Немає подій для відображення</div>';
        return;
    }

    savedMarkers.forEach(marker => {
        const opts = marker.options;
        const latlng = marker.getLatLng();
        
        addEventToList({
            name: opts.title || 'Untitled',
            icon: opts.customIcon || '📍',
            source: opts.source || '',
            description: opts.description || '',
            color: opts.customColor || '#2196F3',
            coordinates: latlng,
            markerId: opts.dbId
        });
    });

    // Додаємо обробники кліків на картки подій
    document.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', () => {
            const markerId = card.dataset.markerId;
            const marker = savedMarkers.find(m => m.options.dbId === markerId);
            
            if (marker) {
                // Відкриваємо popup маркера
                marker.openPopup();
                
                // Центруємо карту на маркері
                map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15), {
                    animate: true,
                    duration: 0.5
                });
                
                // Підсвічуємо картку події
                document.querySelectorAll('.event-card').forEach(c => c.classList.remove('highlight'));
                card.classList.add('highlight');
                
                setTimeout(() => {
                    card.classList.remove('highlight');
                }, 2000);
            }
        });
    });
}

document.getElementById('save-map-btn').addEventListener('click', showSaveCommentForm);
document.getElementById('load-map-btn').addEventListener('click', loadMap);

confirmSaveBtn.addEventListener('click', saveMap);
cancelSaveBtn.addEventListener('click', () => {
    commentFormOverlay.classList.remove('active');
    saveCommentInput.value = '';
});

closeCommentFormBtn.addEventListener('click', () => {
    cancelSaveBtn.click();
});

commentFormOverlay.addEventListener('dbclick', (e) => {
    if (e.target === commentFormOverlay) {
        cancelSaveBtn.click();
    }
});

saveCommentInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        confirmSaveBtn.click();
    }
});

window.addEventListener('DOMContentLoaded', () => {
    loadSettings();  
    loadMap();
    toggleAddButtons(false);
});