// Color Definitions
const COLORS = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Teal', value: '#06b6d4' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Slate', value: '#475569' },
    { name: 'Transparent', value: 'transparent' } // Glassmorphism option
];

// App State
let state = {
    blocks: [],            // List of blocks: { id, x, y, color }
    selectedBlockIds: [],  // Currently selected block IDs
    activeColor: '#ef4444',// Current color from palette
    zoom: 1.0,             // Zoom multiplier
    panX: 0,               // Pan offset X
    panY: 0,               // Pan offset Y
    isPanning: false,      // Panning drag active
    isDraggingBlocks: false,// Block drag active
    isMarqueeSelecting: false, // Selection marquee active
    multiSelectToggle: false, // Persistent multi-select mode (without Shift/Ctrl)
    panStartX: 0,
    panStartY: 0,
    dragStartX: 0,
    dragStartY: 0,
    marqueeStartX: 0,
    marqueeStartY: 0
};

// Config Constants
const CELL_SIZE = 50;
const CANVAS_WIDTH = 2500;
const CANVAS_HEIGHT = 2500;
const GRID_OFFSET_X = 0; // Absolute positioning is cellIndex * CELL_SIZE
const GRID_OFFSET_Y = 0; // Absolute positioning is cellIndex * CELL_SIZE

// DOM Elements
const viewport = document.getElementById('canvas-viewport');
const content = document.getElementById('canvas-content');
const blocksContainer = document.getElementById('blocks-container');
const colorPanel = document.getElementById('color-panel');
const colorSwatches = document.getElementById('color-swatches');
const addBlockBtn = document.getElementById('add-block-btn');
const clearBtn = document.getElementById('clear-btn');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomFitBtn = document.getElementById('zoom-fit');
const zoomLevelText = document.getElementById('zoom-level');
const multiselectToggleBtn = document.getElementById('multiselect-toggle');
const selectionStatus = document.getElementById('selection-status');
const selectionMarquee = document.getElementById('selection-marquee');
const canvasWindow = document.getElementById('canvas-window');

// 40 Outside Slots coordinate definitions (centered around x=20..29, y=20..29)
const OUTSIDE_SLOTS = [];
// Top: row = 19, col = 20..29
for (let c = 20; c <= 29; c++) OUTSIDE_SLOTS.push({ x: c, y: 19 });
// Left: col = 19, row = 20..29
for (let r = 20; r <= 29; r++) OUTSIDE_SLOTS.push({ x: 19, y: r });
// Bottom: row = 30, col = 20..29
for (let c = 20; c <= 29; c++) OUTSIDE_SLOTS.push({ x: c, y: 30 });
// Right: col = 30, row = 20..29
for (let r = 20; r <= 29; r++) OUTSIDE_SLOTS.push({ x: 30, y: r });

// Initialize the Application
function init() {
    setupNumbers();
    setupColorSwatches();
    setupEventListeners();
    setupDraggablePanel(colorPanel);
    
    // Initial centering of the canvas grid
    setTimeout(() => {
        centerGrid();
    }, 50);
}

// Generate the bold numbers 1-10 on the 4 outside sides
function setupNumbers() {
    const labelLeft = document.getElementById('label-left');
    const labelTop = document.getElementById('label-top');
    const labelBottom = document.getElementById('label-bottom');
    const labelRight = document.getElementById('label-right');

    // Left vertical numbers: 1 to 10
    for (let r = 1; r <= 10; r++) {
        const cell = document.createElement('div');
        cell.className = 'label-cell';
        cell.innerHTML = `<span class="cell-number">${r}</span>`;
        labelLeft.appendChild(cell);
    }

    // Top horizontal numbers: 1 to 10
    for (let c = 1; c <= 10; c++) {
        const cell = document.createElement('div');
        cell.className = 'label-cell';
        cell.innerHTML = `<span class="cell-number">${c}</span>`;
        labelTop.appendChild(cell);
    }

    // Bottom horizontal numbers: 1 to 10
    for (let c = 1; c <= 10; c++) {
        const cell = document.createElement('div');
        cell.className = 'label-cell';
        cell.innerHTML = `<span class="cell-number">${c}</span>`;
        labelBottom.appendChild(cell);
    }

    // Right vertical numbers: 1 to 10
    for (let r = 1; r <= 10; r++) {
        const cell = document.createElement('div');
        cell.className = 'label-cell';
        cell.innerHTML = `<span class="cell-number">${r}</span>`;
        labelRight.appendChild(cell);
    }
}

// Setup the 11 Color swatches in the panel
function setupColorSwatches() {
    colorSwatches.innerHTML = '';
    COLORS.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'swatch';
        swatch.dataset.color = color.value;
        swatch.title = color.name;
        if (color.value !== 'transparent') {
            swatch.style.backgroundColor = color.value;
        }
        
        if (color.value === state.activeColor) {
            swatch.classList.add('active');
        }

        swatch.addEventListener('click', () => {
            document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            state.activeColor = color.value;

            // Apply selected color to all currently selected blocks
            if (state.selectedBlockIds.length > 0) {
                state.selectedBlockIds.forEach(id => {
                    const block = state.blocks.find(b => b.id === id);
                    if (block) {
                        block.color = color.value;
                        const blockEl = document.querySelector(`.block[data-id="${id}"]`);
                        if (blockEl) {
                            applyBlockColor(blockEl, color.value);
                        }
                    }
                });
            }
        });

        colorSwatches.appendChild(swatch);
    });
}

// Helper to apply color or transparent styling to a block element
function applyBlockColor(element, color) {
    if (color === 'transparent') {
        element.className = 'block block-transparent';
        element.style.backgroundColor = '';
    } else {
        element.className = 'block';
        element.style.backgroundColor = color;
    }
}

// Make a panel draggable
function setupDraggablePanel(panel) {
    const handle = panel.querySelector('.panel-handle');
    let panelX = 0, panelY = 0;

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        panelX = e.clientX - panel.offsetLeft;
        panelY = e.clientY - panel.offsetTop;
        
        document.addEventListener('mousemove', onPanelDrag);
        document.addEventListener('mouseup', onPanelDragEnd);
    });

    function onPanelDrag(e) {
        panel.style.left = `${e.clientX - panelX}px`;
        panel.style.top = `${e.clientY - panelY}px`;
        panel.style.position = 'fixed';
    }

    function onPanelDragEnd() {
        document.removeEventListener('mousemove', onPanelDrag);
        document.removeEventListener('mouseup', onPanelDragEnd);
    }
}

// Center the 12x12 grid inside the resizable viewport window
function centerGrid() {
    state.zoom = 1.0;
    state.panX = 0;
    state.panY = 0;
    updateCanvasTransform();
}

// Render the zoom and pan transitions on the canvas content container
function updateCanvasTransform() {
    content.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    zoomLevelText.textContent = `${Math.round(state.zoom * 100)}%`;
}

// Convert screen viewport coordinates to scaled canvas grid pixels
function screenToCanvas(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const viewX = clientX - rect.left;
    const viewY = clientY - rect.top;
    const viewWidth = rect.width;
    const viewHeight = rect.height;
    return {
        x: (viewX - viewWidth / 2 - state.panX) / state.zoom + 1250,
        y: (viewY - viewHeight / 2 - state.panY) / state.zoom + 1250
    };
}

// Update the Selection status text in the window bar
function updateSelectionUI() {
    if (state.selectedBlockIds.length === 0) {
        selectionStatus.textContent = 'No selection';
        multiselectToggleBtn.classList.remove('active');
    } else {
        selectionStatus.textContent = `${state.selectedBlockIds.length} block(s) selected`;
    }

    // Refresh outlines
    document.querySelectorAll('.block').forEach(blockEl => {
        const id = blockEl.dataset.id;
        if (state.selectedBlockIds.includes(id)) {
            blockEl.classList.add('selected');
        } else {
            blockEl.classList.remove('selected');
        }
    });
}

// Add a block to the canvas
function addBlock() {
    // 1. Check the 40 outside slots in order
    let targetSlot = null;
    for (let slot of OUTSIDE_SLOTS) {
        // Is slot occupied?
        const occupied = state.blocks.some(b => b.x === slot.x && b.y === slot.y);
        if (!occupied) {
            targetSlot = slot;
            break;
        }
    }

    // 2. If no outside slot is empty, check the 100 cells of the main grid (20..29)
    if (!targetSlot) {
        for (let y = 20; y <= 29; y++) {
            for (let x = 20; x <= 29; x++) {
                const occupied = state.blocks.some(b => b.x === x && b.y === y);
                if (!occupied) {
                    targetSlot = { x, y };
                    break;
                }
            }
            if (targetSlot) break;
        }
    }

    // 3. Fallback: place in some nearby spot if fully crowded
    if (!targetSlot) {
        let i = 18;
        while (!targetSlot) {
            const occupied = state.blocks.some(b => b.x === i && b.y === 20);
            if (!occupied) targetSlot = { x: i, y: 20 };
            i--;
        }
    }

    // Create block object
    const newBlock = {
        id: 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        x: targetSlot.x,
        y: targetSlot.y,
        color: state.activeColor
    };

    state.blocks.push(newBlock);
    renderBlock(newBlock);

    // Auto-select the newly added block
    state.selectedBlockIds = [newBlock.id];
    updateSelectionUI();
}

// Render block object to DOM
function renderBlock(block) {
    const blockEl = document.createElement('div');
    blockEl.className = 'block';
    blockEl.dataset.id = block.id;
    
    // Position
    blockEl.style.left = `${GRID_OFFSET_X + block.x * CELL_SIZE}px`;
    blockEl.style.top = `${GRID_OFFSET_Y + block.y * CELL_SIZE}px`;
    
    applyBlockColor(blockEl, block.color);

    // Single click handler (to select & change colors)
    blockEl.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Multi-select modifier check (Shift, Ctrl, or MultiSelectToggle)
        const isMulti = e.shiftKey || e.ctrlKey || state.multiSelectToggle;
        
        if (isMulti) {
            if (state.selectedBlockIds.includes(block.id)) {
                state.selectedBlockIds = state.selectedBlockIds.filter(id => id !== block.id);
            } else {
                state.selectedBlockIds.push(block.id);
            }
        } else {
            state.selectedBlockIds = [block.id];
        }
        
        updateSelectionUI();
    });

    blocksContainer.appendChild(blockEl);
}

// Clear all blocks
function clearAll() {
    state.blocks = [];
    state.selectedBlockIds = [];
    blocksContainer.innerHTML = '';
    updateSelectionUI();
}

// Zoom utility
function adjustZoom(factor, clientX = null, clientY = null) {
    const prevZoom = state.zoom;
    let newZoom = state.zoom * factor;
    // Limit bounds
    newZoom = Math.max(0.3, Math.min(3.0, newZoom));
    
    const rect = viewport.getBoundingClientRect();
    const viewWidth = rect.width;
    const viewHeight = rect.height;

    let anchorX, anchorY;
    if (clientX !== null && clientY !== null) {
        anchorX = clientX - rect.left;
        anchorY = clientY - rect.top;
    } else {
        anchorX = viewWidth / 2;
        anchorY = viewHeight / 2;
    }

    // Calculate workspace coordinates before zoom
    const cx = (anchorX - viewWidth / 2 - state.panX) / prevZoom + 1250;
    const cy = (anchorY - viewHeight / 2 - state.panY) / prevZoom + 1250;

    state.zoom = newZoom;
    state.panX = anchorX - viewWidth / 2 - (cx - 1250) * newZoom;
    state.panY = anchorY - viewHeight / 2 - (cy - 1250) * newZoom;

    updateCanvasTransform();
}

// Setup Keyboard, Mouse, and Window drag listeners
function setupEventListeners() {
    // 1. Add / Clear Buttons
    addBlockBtn.addEventListener('click', addBlock);
    clearBtn.addEventListener('click', clearAll);

    // 2. Zoom Control Panel
    zoomInBtn.addEventListener('click', () => adjustZoom(1.2));
    zoomOutBtn.addEventListener('click', () => adjustZoom(1 / 1.2));
    zoomFitBtn.addEventListener('click', centerGrid);
    
    // Toggle Multi-Select Mode button
    multiselectToggleBtn.addEventListener('click', () => {
        state.multiSelectToggle = !state.multiSelectToggle;
        multiselectToggleBtn.classList.toggle('active', state.multiSelectToggle);
    });

    // 3. Mouse Wheel Zoom
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : (1 / 1.1);
        adjustZoom(factor, e.clientX, e.clientY);
    }, { passive: false });

    // 4. Global Viewport Interactivity (Panning, Dragging blocks, Marquee Select)
    viewport.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Keyboard controls (e.g. Delete keys to remove selected blocks)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (state.selectedBlockIds.length > 0) {
                state.blocks = state.blocks.filter(b => {
                    if (state.selectedBlockIds.includes(b.id)) {
                        const el = document.querySelector(`.block[data-id="${b.id}"]`);
                        if (el) el.remove();
                        return false;
                    }
                    return true;
                });
                state.selectedBlockIds = [];
                updateSelectionUI();
            }
        }
    });

    // Prevent right-click context menu on canvas so it can be used for panning
    viewport.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

// Drag States Variables
let dragBlocksOrigPos = []; // [{ id, x, y, el, startLeft, startTop }]
let activeDragAnchorId = null;

function onMouseDown(e) {
    const isRightButton = e.button === 2;
    const isMiddleButton = e.button === 1;
    const isSpaceBarPressed = e.code === 'Space' || (e.type === 'keydown' && e.code === 'Space');
    
    // Check if clicking a block
    const blockEl = e.target.closest('.block');

    // Case A: Pan Mode (Right click, Middle click, Space+Left click)
    if (isRightButton || isMiddleButton || e.spaceKey || (e.button === 0 && e.shiftKey === false && e.ctrlKey === false && !blockEl && state.multiSelectToggle === false && e.altKey)) {
        state.isPanning = true;
        state.panStartX = e.clientX - state.panX;
        state.panStartY = e.clientY - state.panY;
        viewport.style.cursor = 'grabbing';
        return;
    }

    // Case B: Left Click and Dragging Block(s)
    if (e.button === 0 && blockEl) {
        const blockId = blockEl.dataset.id;
        
        // If block is not selected, select it (unless adding to selection)
        const isMulti = e.shiftKey || e.ctrlKey || state.multiSelectToggle;
        if (!state.selectedBlockIds.includes(blockId)) {
            if (isMulti) {
                state.selectedBlockIds.push(blockId);
            } else {
                state.selectedBlockIds = [blockId];
            }
            updateSelectionUI();
        }

        state.isDraggingBlocks = true;
        activeDragAnchorId = blockId;
        
        const canvasMouse = screenToCanvas(e.clientX, e.clientY);
        state.dragStartX = canvasMouse.x;
        state.dragStartY = canvasMouse.y;

        // Remember initial offsets & positions for all selected blocks
        dragBlocksOrigPos = state.selectedBlockIds.map(id => {
            const blockObj = state.blocks.find(b => b.id === id);
            const el = document.querySelector(`.block[data-id="${id}"]`);
            return {
                id: id,
                origX: blockObj.x,
                origY: blockObj.y,
                el: el,
                startLeft: parseFloat(el.style.left),
                startTop: parseFloat(el.style.top)
            };
        });

        // Add visual grabbing styling
        dragBlocksOrigPos.forEach(item => {
            item.el.style.cursor = 'grabbing';
            // Show previews
            createDragPreview(item.id, item.origX, item.origY);
        });

        e.preventDefault();
        return;
    }

    // Case C: Left Click on Empty Space -> Marquee Selection
    if (e.button === 0 && !blockEl) {
        state.isMarqueeSelecting = true;
        const canvasMouse = screenToCanvas(e.clientX, e.clientY);
        state.marqueeStartX = canvasMouse.x;
        state.marqueeStartY = canvasMouse.y;

        // Clear selection unless holding multi-select modifiers
        const isMulti = e.shiftKey || e.ctrlKey || state.multiSelectToggle;
        if (!isMulti) {
            state.selectedBlockIds = [];
            updateSelectionUI();
        }

        selectionMarquee.style.display = 'block';
        selectionMarquee.style.left = `${state.marqueeStartX}px`;
        selectionMarquee.style.top = `${state.marqueeStartY}px`;
        selectionMarquee.style.width = '0px';
        selectionMarquee.style.height = '0px';
        
        e.preventDefault();
    }
}

// Previews map
let dragPreviews = {}; // { blockId: previewElement }

function createDragPreview(id, x, y) {
    if (dragPreviews[id]) return;
    
    const preview = document.createElement('div');
    preview.className = 'drag-preview';
    preview.style.left = `${GRID_OFFSET_X + x * CELL_SIZE}px`;
    preview.style.top = `${GRID_OFFSET_Y + y * CELL_SIZE}px`;
    preview.style.display = 'block';
    
    content.appendChild(preview);
    dragPreviews[id] = preview;
}

function updateDragPreviews(snappedCoords) {
    // snappedCoords: { id: {x, y} }
    Object.keys(snappedCoords).forEach(id => {
        const preview = dragPreviews[id];
        if (preview) {
            const coords = snappedCoords[id];
            preview.style.left = `${GRID_OFFSET_X + coords.x * CELL_SIZE}px`;
            preview.style.top = `${GRID_OFFSET_Y + coords.y * CELL_SIZE}px`;
        }
    });
}

function clearDragPreviews() {
    Object.values(dragPreviews).forEach(p => p.remove());
    dragPreviews = {};
}

function onMouseMove(e) {
    // Handle Canvas Panning
    if (state.isPanning) {
        state.panX = e.clientX - state.panStartX;
        state.panY = e.clientY - state.panStartY;
        updateCanvasTransform();
        return;
    }

    // Handle Dragging Blocks
    if (state.isDraggingBlocks) {
        const canvasMouse = screenToCanvas(e.clientX, e.clientY);
        const dx = canvasMouse.x - state.dragStartX;
        const dy = canvasMouse.y - state.dragStartY;

        let snappedCoords = {};

        // 1. Move the elements in real-time and calculate their snap-to coordinates
        dragBlocksOrigPos.forEach(item => {
            const currentLeft = item.startLeft + dx;
            const currentTop = item.startTop + dy;
            item.el.style.left = `${currentLeft}px`;
            item.el.style.top = `${currentTop}px`;

            // Snapped target coordinates
            const snappedX = Math.round((currentLeft - GRID_OFFSET_X) / CELL_SIZE);
            const snappedY = Math.round((currentTop - GRID_OFFSET_Y) / CELL_SIZE);
            snappedCoords[item.id] = { x: snappedX, y: snappedY };
        });

        // 2. Display snapped dashed preview frames
        updateDragPreviews(snappedCoords);
        return;
    }

    // Handle Marquee Selecting
    if (state.isMarqueeSelecting) {
        const canvasMouse = screenToCanvas(e.clientX, e.clientY);
        
        const left = Math.min(state.marqueeStartX, canvasMouse.x);
        const top = Math.min(state.marqueeStartY, canvasMouse.y);
        const width = Math.abs(state.marqueeStartX - canvasMouse.x);
        const height = Math.abs(state.marqueeStartY - canvasMouse.y);

        selectionMarquee.style.left = `${left}px`;
        selectionMarquee.style.top = `${top}px`;
        selectionMarquee.style.width = `${width}px`;
        selectionMarquee.style.height = `${height}px`;

        // Check intersections with all blocks
        const marqueeBox = { left, top, right: left + width, bottom: top + height };
        
        state.blocks.forEach(block => {
            const blockLeft = GRID_OFFSET_X + block.x * CELL_SIZE;
            const blockTop = GRID_OFFSET_Y + block.y * CELL_SIZE;
            const blockBox = {
                left: blockLeft,
                top: blockTop,
                right: blockLeft + CELL_SIZE,
                bottom: blockTop + CELL_SIZE
            };

            const intersects = !(blockBox.left >= marqueeBox.right ||
                                 blockBox.right <= marqueeBox.left ||
                                 blockBox.top >= marqueeBox.bottom ||
                                 blockBox.bottom <= marqueeBox.top);

            const blockEl = document.querySelector(`.block[data-id="${block.id}"]`);
            if (intersects) {
                blockEl.classList.add('selected');
            } else {
                // If not in the selected list originally, remove class
                if (!state.selectedBlockIds.includes(block.id)) {
                    blockEl.classList.remove('selected');
                }
            }
        });
    }
}

function onMouseUp(e) {
    if (state.isPanning) {
        state.isPanning = false;
        viewport.style.cursor = 'grab';
        return;
    }

    if (state.isDraggingBlocks) {
        state.isDraggingBlocks = false;
        
        const canvasMouse = screenToCanvas(e.clientX, e.clientY);
        const dx = canvasMouse.x - state.dragStartX;
        const dy = canvasMouse.y - state.dragStartY;

        // Calculate final snap positions
        let proposedPositions = {};
        let overlapDetected = false;

        dragBlocksOrigPos.forEach(item => {
            const currentLeft = item.startLeft + dx;
            const currentTop = item.startTop + dy;
            const snappedX = Math.round((currentLeft - GRID_OFFSET_X) / CELL_SIZE);
            const snappedY = Math.round((currentTop - GRID_OFFSET_Y) / CELL_SIZE);
            
            proposedPositions[item.id] = { x: snappedX, y: snappedY };
        });

        // Collision Check: proposed spots vs non-selected blocks
        const nonSelectedBlocks = state.blocks.filter(b => !state.selectedBlockIds.includes(b.id));

        for (let itemId of Object.keys(proposedPositions)) {
            const pos = proposedPositions[itemId];
            
            // Overlaps with any stationary block?
            const isOverlap = nonSelectedBlocks.some(b => b.x === pos.x && b.y === pos.y);
            if (isOverlap) {
                overlapDetected = true;
                break;
            }
        }

        // Apply new positions or revert if collision happens
        dragBlocksOrigPos.forEach(item => {
            const blockObj = state.blocks.find(b => b.id === item.id);
            item.el.style.cursor = 'grab';

            if (!overlapDetected) {
                // Set new positions
                const newPos = proposedPositions[item.id];
                blockObj.x = newPos.x;
                blockObj.y = newPos.y;
            }

            // Snap elements to their final grid coordinates
            item.el.style.left = `${GRID_OFFSET_X + blockObj.x * CELL_SIZE}px`;
            item.el.style.top = `${GRID_OFFSET_Y + blockObj.y * CELL_SIZE}px`;
        });

        // Red flash to indicate collision/reversion
        if (overlapDetected) {
            dragBlocksOrigPos.forEach(item => {
                item.el.style.borderColor = '#ef4444';
                setTimeout(() => {
                    item.el.style.borderColor = 'rgba(0, 0, 0, 0.15)';
                }, 400);
            });
        }

        clearDragPreviews();
        dragBlocksOrigPos = [];
        activeDragAnchorId = null;
        return;
    }

    if (state.isMarqueeSelecting) {
        state.isMarqueeSelecting = false;
        selectionMarquee.style.display = 'none';

        // Read marquee coordinates
        const left = parseFloat(selectionMarquee.style.left);
        const top = parseFloat(selectionMarquee.style.top);
        const width = parseFloat(selectionMarquee.style.width);
        const height = parseFloat(selectionMarquee.style.height);

        const marqueeBox = { left, top, right: left + width, bottom: top + height };
        
        // Finalize selection list
        state.blocks.forEach(block => {
            const blockLeft = GRID_OFFSET_X + block.x * CELL_SIZE;
            const blockTop = GRID_OFFSET_Y + block.y * CELL_SIZE;
            const blockBox = {
                left: blockLeft,
                top: blockTop,
                right: blockLeft + CELL_SIZE,
                bottom: blockTop + CELL_SIZE
            };

            const intersects = !(blockBox.left >= marqueeBox.right ||
                                 blockBox.right <= marqueeBox.left ||
                                 blockBox.top >= marqueeBox.bottom ||
                                 blockBox.bottom <= marqueeBox.top);

            if (intersects) {
                if (!state.selectedBlockIds.includes(block.id)) {
                    state.selectedBlockIds.push(block.id);
                }
            }
        });

        updateSelectionUI();
    }
}

// Start the app on load
window.addEventListener('DOMContentLoaded', init);
