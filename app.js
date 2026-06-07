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
    { name: 'Transparent', value: 'transparent' }
];

// App State
let state = {
    blocks: [],            // List of blocks: { id, x, y, color, text, generatedBy }
    selectedBlockIds: [],  // Currently selected block IDs
    activeColor: '#ef4444',// Current color from palette
    zoom: 1.0,             // Zoom multiplier
    panX: 0,               // Pan offset X
    panY: 0,               // Pan offset Y
    isPanning: false,      // Panning drag active
    isDraggingBlocks: false,// Block drag active
    isMarqueeSelecting: false, // Selection marquee active
    isEditingText: false,  // Currently typing text inside a block
    multiSelectToggle: false, // Persistent multi-select mode
    panStartX: 0,
    panStartY: 0,
    dragStartX: 0,
    dragStartY: 0,
    marqueeStartX: 0,
    marqueeStartY: 0,
    
    // Dynamic Grid Sizing
    gridWidth: 10,
    gridHeight: 10,
    // Store input values to preserve them during grid resizing
    inputValues: {
        top: {},
        bottom: {},
        left: {},
        right: {}
    }
};

// Config Constants
const CELL_SIZE = 50;
const CANVAS_WIDTH = 2500;
const CANVAS_HEIGHT = 2500;
const GRID_OFFSET_X = 0;
const GRID_OFFSET_Y = 0;

// Dynamic Boundary Variables
let startCol = 20;
let endCol = 29;
let startRow = 20;
let endRow = 29;
let OUTSIDE_SLOTS = []; // Outside label slots dynamically computed

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

// Initialize the Application
function init() {
    rebuildLanes();
    setupColorSwatches();
    setupEventListeners();
    setupDraggablePanel(colorPanel);
    
    setTimeout(() => {
        centerGrid();
    }, 50);
}

// Calculate grid boundary variables based on grid size
function updateGridBoundaries() {
    startCol = Math.floor((50 - state.gridWidth) / 2);
    endCol = startCol + state.gridWidth - 1;
    startRow = Math.floor((50 - state.gridHeight) / 2);
    endRow = startRow + state.gridHeight - 1;
    
    // Generate outside label slot coordinates
    OUTSIDE_SLOTS = [];
    // Top label lane
    for (let c = startCol; c <= endCol; c++) OUTSIDE_SLOTS.push({ x: c, y: startRow - 1 });
    // Left label lane
    for (let r = startRow; r <= endRow; r++) OUTSIDE_SLOTS.push({ x: startCol - 1, y: r });
    // Bottom label lane
    for (let c = startCol; c <= endCol; c++) OUTSIDE_SLOTS.push({ x: c, y: endRow + 1 });
    // Right label lane
    for (let r = startRow; r <= endRow; r++) OUTSIDE_SLOTS.push({ x: endCol + 1, y: r });
}

// Reposition and resize grid elements dynamically
function repositionGridElements() {
    const mainGrid = document.getElementById('main-grid');
    mainGrid.style.left = `${startCol * CELL_SIZE}px`;
    mainGrid.style.top = `${startRow * CELL_SIZE}px`;
    mainGrid.style.width = `${state.gridWidth * CELL_SIZE}px`;
    mainGrid.style.height = `${state.gridHeight * CELL_SIZE}px`;

    const lanes = [
        { id: 'label-left',   left: startCol - 1, top: startRow,     width: 1,                 height: state.gridHeight,  dir: 'column' },
        { id: 'label-top',    left: startCol,     top: startRow - 1, width: state.gridWidth,   height: 1,                 dir: 'row' },
        { id: 'label-bottom', left: startCol,     top: endRow + 1,   width: state.gridWidth,   height: 1,                 dir: 'row' },
        { id: 'label-right',  left: endCol + 1,   top: startRow,     width: 1,                 height: state.gridHeight,  dir: 'column' },
        { id: 'input-left',   left: startCol - 2, top: startRow,     width: 1,                 height: state.gridHeight,  dir: 'column' },
        { id: 'input-top',    left: startCol,     top: startRow - 2, width: state.gridWidth,   height: 1,                 dir: 'row' },
        { id: 'input-bottom', left: startCol,     top: endRow + 2,   width: state.gridWidth,   height: 1,                 dir: 'row' },
        { id: 'input-right',  left: endCol + 2,   top: startRow,     width: 1,                 height: state.gridHeight,  dir: 'column' }
    ];

    lanes.forEach(lane => {
        const el = document.getElementById(lane.id);
        if (el) {
            el.style.left = `${lane.left * CELL_SIZE}px`;
            el.style.top = `${lane.top * CELL_SIZE}px`;
            el.style.width = `${lane.width * CELL_SIZE}px`;
            el.style.height = `${lane.height * CELL_SIZE}px`;
            el.style.flexDirection = lane.dir;
        }
    });
}

// Rebuild label lanes and inputs
function rebuildLanes() {
    updateGridBoundaries();
    repositionGridElements();

    const laneConfigs = [
        { type: 'left',   labelEl: 'label-left',   inputEl: 'input-left',   count: state.gridHeight, startIdx: startRow },
        { type: 'top',    labelEl: 'label-top',    inputEl: 'input-top',    count: state.gridWidth,  startIdx: startCol },
        { type: 'bottom', labelEl: 'label-bottom', inputEl: 'input-bottom', count: state.gridWidth,  startIdx: startCol },
        { type: 'right',  labelEl: 'label-right',  inputEl: 'input-right',  count: state.gridHeight, startIdx: startRow }
    ];

    // Clear blocks previously spawned by input lanes, as their coords will shift
    state.blocks = state.blocks.filter(b => !b.generatedBy);

    laneConfigs.forEach(cfg => {
        const lblContainer = document.getElementById(cfg.labelEl);
        const inpContainer = document.getElementById(cfg.inputEl);
        if (!lblContainer || !inpContainer) return;

        lblContainer.innerHTML = '';
        inpContainer.innerHTML = '';

        for (let i = 0; i < cfg.count; i++) {
            const numVal = i + 1;
            const labelCell = document.createElement('div');
            labelCell.className = 'label-cell';
            labelCell.innerHTML = `<span class="cell-number">${numVal}</span>`;
            lblContainer.appendChild(labelCell);

            const coordIndex = cfg.startIdx + i;
            const inputId = `input_${cfg.type}_${coordIndex}`;
            const inputCell = createInputCell(cfg.type, coordIndex, inputId);
            inpContainer.appendChild(inputCell);

            // Restore any stored values for this lane
            const savedVal = state.inputValues[cfg.type][coordIndex];
            if (savedVal > 0) {
                const inputEl = inputCell.querySelector('.lane-input');
                inputEl.value = savedVal;
                generateBlocksForInput(inputId, cfg.type, coordIndex, savedVal, false);
            }
        }
    });

    refreshAllBlocksDOM();
}

function refreshAllBlocksDOM() {
    blocksContainer.innerHTML = '';
    state.blocks.forEach(renderBlock);
}

// Helper to create an input cell element with key and input events
function createInputCell(laneType, index, inputId) {
    const cell = document.createElement('div');
    cell.className = 'input-cell';

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'lane-input';
    input.min = '0';
    input.max = '20';
    input.id = inputId;

    // Stop propagation of keys like Backspace/Delete while typing
    input.addEventListener('keydown', (e) => e.stopPropagation());

    input.addEventListener('input', () => {
        let val = parseInt(input.value);
        if (isNaN(val) || val < 0) val = 0;
        if (val > 20) {
            val = 20;
            input.value = 20;
        }
        state.inputValues[laneType][index] = val;
        generateBlocksForInput(inputId, laneType, index, val, true);
    });

    cell.appendChild(input);
    return cell;
}

// Spawning offset calculator
const DIRECTION_OFFSETS = {
    top:    (index, i) => ({ x: index, y: (startRow - 1) - i }),
    bottom: (index, i) => ({ x: index, y: (endRow + 1) + i }),
    left:   (index, i) => ({ x: (startCol - 1) - i, y: index }),
    right:  (index, i) => ({ x: (endCol + 1) + i, y: index })
};

// Spawns blocks extending away from the grid reactively
function generateBlocksForInput(inputId, laneType, index, N, shouldRender = true) {
    // 1. Remove previously generated blocks for this input ID
    state.blocks = state.blocks.filter(b => {
        if (b.generatedBy === inputId) {
            if (shouldRender) {
                const el = document.querySelector(`.block[data-id="${b.id}"]`);
                if (el) el.remove();
            }
            return false;
        }
        return true;
    });

    // 2. Generate N new blocks
    for (let i = 0; i < N; i++) {
        const { x, y } = DIRECTION_OFFSETS[laneType](index, i);

        // Spawn block object
        const newBlock = {
            id: 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            x,
            y,
            color: state.activeColor,
            generatedBy: inputId
        };

        state.blocks.push(newBlock);
        if (shouldRender) renderBlock(newBlock);
    }
}

// Setup the color swatches in the panel
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
                        if (blockEl) applyBlockColor(blockEl, color.value);
                    }
                });
            }
        });

        colorSwatches.appendChild(swatch);
    });
}

// Helper to calculate high-contrast text color
function getContrastColor(colorVal) {
    if (colorVal === 'transparent') return '#000000';
    if (colorVal.startsWith('#')) {
        const hex = colorVal.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 140) ? '#000000' : '#ffffff';
    }
    return '#ffffff';
}

// Helper to apply color styling to a block element
function applyBlockColor(element, color) {
    if (color === 'transparent') {
        element.className = 'block block-transparent';
        element.style.backgroundColor = '';
    } else {
        element.className = 'block';
        element.style.backgroundColor = color;
    }
    
    const textEl = element.querySelector('.block-text');
    if (textEl) textEl.style.color = getContrastColor(color);
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

// Center the grid inside the resizable viewport window
function centerGrid() {
    const rect = viewport.getBoundingClientRect();
    const fitCells = Math.max(state.gridWidth, state.gridHeight) + 10;
    const fitSize = fitCells * CELL_SIZE;
    
    const zoomX = rect.width / fitSize;
    const zoomY = rect.height / fitSize;
    
    state.zoom = Math.max(0.3, Math.min(1.2, Math.min(zoomX, zoomY)));
    state.panX = 0;
    state.panY = 0;
    updateCanvasTransform();
}

// Render the zoom and pan transitions
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

// Update the Selection status text
function updateSelectionUI() {
    if (state.selectedBlockIds.length === 0) {
        selectionStatus.textContent = 'No selection';
        multiselectToggleBtn.classList.remove('active');
    } else {
        selectionStatus.textContent = `${state.selectedBlockIds.length} block(s) selected`;
    }

    document.querySelectorAll('.block').forEach(blockEl => {
        const id = blockEl.dataset.id;
        blockEl.classList.toggle('selected', state.selectedBlockIds.includes(id));
    });
}

// Add a block sequentially
function addBlock() {
    let targetSlot = null;
    
    // 1. Check label outside slots
    for (let slot of OUTSIDE_SLOTS) {
        if (!state.blocks.some(b => b.x === slot.x && b.y === slot.y)) {
            targetSlot = slot;
            break;
        }
    }

    // 2. Scan main grid
    if (!targetSlot) {
        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                if (!state.blocks.some(b => b.x === x && b.y === y)) {
                    targetSlot = { x, y };
                    break;
                }
            }
            if (targetSlot) break;
        }
    }

    // 3. Fallback: extend leftwards from outside lane
    if (!targetSlot) {
        let i = startCol - 3;
        while (!targetSlot) {
            if (!state.blocks.some(b => b.x === i && b.y === startRow)) {
                targetSlot = { x: i, y: startRow };
            }
            i--;
        }
    }

    const newBlock = {
        id: 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        x: targetSlot.x,
        y: targetSlot.y,
        color: state.activeColor
    };

    state.blocks.push(newBlock);
    renderBlock(newBlock);

    state.selectedBlockIds = [newBlock.id];
    updateSelectionUI();
}

// Render block object to DOM
function renderBlock(block) {
    const blockEl = document.createElement('div');
    blockEl.className = 'block';
    blockEl.dataset.id = block.id;
    blockEl.style.left = `${GRID_OFFSET_X + block.x * CELL_SIZE}px`;
    blockEl.style.top = `${GRID_OFFSET_Y + block.y * CELL_SIZE}px`;
    
    const textEl = document.createElement('div');
    textEl.className = 'block-text';
    textEl.contentEditable = true;
    textEl.textContent = block.text || '';
    
    textEl.addEventListener('keydown', (e) => e.stopPropagation());
    textEl.addEventListener('focus', () => { state.isEditingText = true; });
    textEl.addEventListener('blur', () => {
        state.isEditingText = false;
        block.text = textEl.textContent;
    });
    
    blockEl.appendChild(textEl);
    applyBlockColor(blockEl, block.color);

    blockEl.addEventListener('click', (e) => {
        e.stopPropagation();
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

// Clear all blocks and inputs
function clearAll() {
    state.blocks = [];
    state.selectedBlockIds = [];
    state.inputValues = { top: {}, bottom: {}, left: {}, right: {} };
    blocksContainer.innerHTML = '';
    
    document.querySelectorAll('.lane-input').forEach(input => {
        input.value = '';
    });
    
    updateSelectionUI();
}

// Zoom utility
function adjustZoom(factor, clientX = null, clientY = null) {
    const prevZoom = state.zoom;
    let newZoom = Math.max(0.3, Math.min(3.0, state.zoom * factor));
    
    const rect = viewport.getBoundingClientRect();
    const viewWidth = rect.width;
    const viewHeight = rect.height;

    let anchorX = (clientX !== null) ? (clientX - rect.left) : (viewWidth / 2);
    let anchorY = (clientY !== null) ? (clientY - rect.top) : (viewHeight / 2);

    const cx = (anchorX - viewWidth / 2 - state.panX) / prevZoom + 1250;
    const cy = (anchorY - viewHeight / 2 - state.panY) / prevZoom + 1250;

    state.zoom = newZoom;
    state.panX = anchorX - viewWidth / 2 - (cx - 1250) * newZoom;
    state.panY = anchorY - viewHeight / 2 - (cy - 1250) * newZoom;

    updateCanvasTransform();
}

// Setup Keyboard, Mouse, and Window drag listeners
function setupEventListeners() {
    addBlockBtn.addEventListener('click', addBlock);
    clearBtn.addEventListener('click', clearAll);

    zoomInBtn.addEventListener('click', () => adjustZoom(1.2));
    zoomOutBtn.addEventListener('click', () => adjustZoom(1 / 1.2));
    zoomFitBtn.addEventListener('click', centerGrid);
    
    multiselectToggleBtn.addEventListener('click', () => {
        state.multiSelectToggle = !state.multiSelectToggle;
        multiselectToggleBtn.classList.toggle('active', state.multiSelectToggle);
    });

    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        adjustZoom(e.deltaY < 0 ? 1.1 : (1 / 1.1), e.clientX, e.clientY);
    }, { passive: false });

    viewport.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedBlockIds.length > 0) {
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
    });

    viewport.addEventListener('contextmenu', (e) => e.preventDefault());

    // Sizing Inputs Change Handlers
    const widthInput = document.getElementById('grid-width-input');
    const heightInput = document.getElementById('grid-height-input');

    const handleResize = () => {
        let w = parseInt(widthInput.value);
        let h = parseInt(heightInput.value);
        w = isNaN(w) || w < 2 ? 2 : (w > 24 ? 24 : w);
        h = isNaN(h) || h < 2 ? 2 : (h > 24 ? 24 : h);

        widthInput.value = w;
        heightInput.value = h;

        if (state.gridWidth !== w || state.gridHeight !== h) {
            state.gridWidth = w;
            state.gridHeight = h;
            rebuildLanes();
            centerGrid();
        }
    };

    widthInput.addEventListener('change', handleResize);
    heightInput.addEventListener('change', handleResize);
}

// Drag States Variables
let dragBlocksOrigPos = [];
let activeDragAnchorId = null;
let dragPreviews = {};

function onMouseDown(e) {
    if (state.isEditingText) return;
    if (e.target.classList.contains('block-text') && document.activeElement === e.target) return;

    const isRightButton = e.button === 2;
    const isMiddleButton = e.button === 1;
    const blockEl = e.target.closest('.block');

    // Case A: Pan Mode
    if (isRightButton || isMiddleButton || e.spaceKey || (e.button === 0 && !blockEl && e.altKey)) {
        state.isPanning = true;
        state.panStartX = e.clientX - state.panX;
        state.panStartY = e.clientY - state.panY;
        viewport.style.cursor = 'grabbing';
        return;
    }

    // Case B: Left Click and Dragging Block(s)
    if (e.button === 0 && blockEl) {
        const blockId = blockEl.dataset.id;
        const isMulti = e.shiftKey || e.ctrlKey || state.multiSelectToggle;
        if (!state.selectedBlockIds.includes(blockId)) {
            state.selectedBlockIds = isMulti ? [...state.selectedBlockIds, blockId] : [blockId];
            updateSelectionUI();
        }

        state.isDraggingBlocks = true;
        activeDragAnchorId = blockId;
        
        const canvasMouse = screenToCanvas(e.clientX, e.clientY);
        state.dragStartX = canvasMouse.x;
        state.dragStartY = canvasMouse.y;

        dragBlocksOrigPos = state.selectedBlockIds.map(id => {
            const blockObj = state.blocks.find(b => b.id === id);
            const el = document.querySelector(`.block[data-id="${id}"]`);
            return {
                id,
                origX: blockObj.x,
                origY: blockObj.y,
                el,
                startLeft: parseFloat(el.style.left),
                startTop: parseFloat(el.style.top)
            };
        });

        dragBlocksOrigPos.forEach(item => {
            item.el.style.cursor = 'grabbing';
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
    if (state.isPanning) {
        state.panX = e.clientX - state.panStartX;
        state.panY = e.clientY - state.panStartY;
        updateCanvasTransform();
        return;
    }

    if (state.isDraggingBlocks) {
        const canvasMouse = screenToCanvas(e.clientX, e.clientY);
        const dx = canvasMouse.x - state.dragStartX;
        const dy = canvasMouse.y - state.dragStartY;

        let snappedCoords = {};

        dragBlocksOrigPos.forEach(item => {
            const currentLeft = item.startLeft + dx;
            const currentTop = item.startTop + dy;
            item.el.style.left = `${currentLeft}px`;
            item.el.style.top = `${currentTop}px`;

            const snappedX = Math.round((currentLeft - GRID_OFFSET_X) / CELL_SIZE);
            const snappedY = Math.round((currentTop - GRID_OFFSET_Y) / CELL_SIZE);
            snappedCoords[item.id] = { x: snappedX, y: snappedY };
        });

        updateDragPreviews(snappedCoords);
        return;
    }

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
            if (blockEl) {
                if (intersects) {
                    blockEl.classList.add('selected');
                } else if (!state.selectedBlockIds.includes(block.id)) {
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

        let proposedPositions = {};
        let overlapDetected = false;

        dragBlocksOrigPos.forEach(item => {
            const currentLeft = item.startLeft + dx;
            const currentTop = item.startTop + dy;
            const snappedX = Math.round((currentLeft - GRID_OFFSET_X) / CELL_SIZE);
            const snappedY = Math.round((currentTop - GRID_OFFSET_Y) / CELL_SIZE);
            
            proposedPositions[item.id] = { x: snappedX, y: snappedY };
        });

        const nonSelectedBlocks = state.blocks.filter(b => !state.selectedBlockIds.includes(b.id));

        for (let itemId of Object.keys(proposedPositions)) {
            const pos = proposedPositions[itemId];
            if (nonSelectedBlocks.some(b => b.x === pos.x && b.y === pos.y)) {
                overlapDetected = true;
                break;
            }
        }

        dragBlocksOrigPos.forEach(item => {
            const blockObj = state.blocks.find(b => b.id === item.id);
            item.el.style.cursor = 'grab';

            if (!overlapDetected) {
                const newPos = proposedPositions[item.id];
                
                // Decouple generated block if it has been moved from its original coordinates
                if (blockObj.generatedBy && (blockObj.x !== newPos.x || blockObj.y !== newPos.y)) {
                    delete blockObj.generatedBy;
                }

                blockObj.x = newPos.x;
                blockObj.y = newPos.y;
            }

            item.el.style.left = `${GRID_OFFSET_X + blockObj.x * CELL_SIZE}px`;
            item.el.style.top = `${GRID_OFFSET_Y + blockObj.y * CELL_SIZE}px`;
        });

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

        const left = parseFloat(selectionMarquee.style.left);
        const top = parseFloat(selectionMarquee.style.top);
        const width = parseFloat(selectionMarquee.style.width);
        const height = parseFloat(selectionMarquee.style.height);

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

            if (intersects && !state.selectedBlockIds.includes(block.id)) {
                state.selectedBlockIds.push(block.id);
            }
        });

        updateSelectionUI();
    }
}

// Start the app on load
window.addEventListener('DOMContentLoaded', init);
