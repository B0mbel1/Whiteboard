import React, { useState, useEffect, useRef } from 'react';

const Shape = ({ id, x, y, width, height, type, selected, onSelect, onUpdate, tool, color, panOffset, limit = 1500 }) => {
    // Domyślne wymiary
    const [dims, setDims] = useState({
        w: width || 100,
        h: height || 100
    });

    const [pos, setPos] = useState({ x, y });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const dragStartRef = useRef({ x: 0, y: 0 });
    const initialPosRef = useRef({ x: 0, y: 0 });
    const initialDimsRef = useRef({ w: 0, h: 0 });

    // Sprawdzamy czy rysujemy
    const isDrawingTool = ['pencil', 'brush', 'eraser'].includes(tool);

    // Synchronizacja z propsami z serwera
    useEffect(() => {
        if (!isDragging && !isResizing) {
            setPos({ x, y });
            setDims({ w: width || (type === 'arrow' ? 100 : 100), h: height || (type === 'arrow' ? 0 : 100) });
        }
    }, [x, y, width, height, isDragging, isResizing, type]);

    const handleMouseDown = (e) => {
        // Blokada interakcji jeśli rysujemy
        if (isDrawingTool) return;

        e.stopPropagation();
        onSelect(id);

        if (e.target.closest('.resize-handle')) return;

        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialPosRef.current = { x: pos.x, y: pos.y };
    };

    const handleResizeStart = (e) => {
        if (isDrawingTool) return;
        e.stopPropagation();
        setIsResizing(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialDimsRef.current = { w: dims.w, h: dims.h };
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                const dx = e.clientX - dragStartRef.current.x;
                const dy = e.clientY - dragStartRef.current.y;

                let newScreenX = initialPosRef.current.x + dx;
                let newScreenY = initialPosRef.current.y + dy;

                if (panOffset) {
                    const worldX = newScreenX - panOffset.x;
                    const worldY = newScreenY - panOffset.y;

                    const clampedWorldX = Math.max(-limit, Math.min(worldX, limit - dims.w));
                    const clampedWorldY = Math.max(-limit, Math.min(worldY, limit - dims.h));

                    newScreenX = clampedWorldX + panOffset.x;
                    newScreenY = clampedWorldY + panOffset.y;
                }
                setPos({ x: newScreenX, y: newScreenY });
            }

            // --- SKALOWANIE (RESIZING) - POPRAWIONE ---
            if (isResizing) {
                const dx = e.clientX - dragStartRef.current.x;
                const dy = e.clientY - dragStartRef.current.y;

                // 1. Obliczamy pozycję X i Y w świecie gry (żeby wiedzieć ile mamy miejsca do ściany)
                const currentWorldX = pos.x - (panOffset ? panOffset.x : 0);
                const currentWorldY = pos.y - (panOffset ? panOffset.y : 0);

                // 2. Obliczamy maksymalną dostępną szerokość/wysokość do granicy świata
                const maxAvailableWidth = limit - currentWorldX;
                const maxAvailableHeight = limit - currentWorldY;

                if (type === 'arrow') {
                    let newW = initialDimsRef.current.w + dx;
                    let newH = initialDimsRef.current.h + dy;

                    // Blokada arrow jest trudniejsza bo może iść w minusy, 
                    // ale dla uproszczenia blokujemy wyjście poza prawą/dolną krawędź dodatnimi wartościami
                    if (newW > maxAvailableWidth) newW = maxAvailableWidth;
                    if (newH > maxAvailableHeight) newH = maxAvailableHeight;

                    setDims({ w: newW, h: newH });
                } else {
                    let newW = Math.max(20, initialDimsRef.current.w + dx);
                    let newH = Math.max(20, initialDimsRef.current.h + dy);

                    // 🔹 BLOKADA: Jeśli nowa szerokość wychodzi poza limit, ucinamy ją
                    if (newW > maxAvailableWidth) {
                        newW = maxAvailableWidth;
                    }
                    // 🔹 BLOKADA: To samo dla wysokości
                    if (newH > maxAvailableHeight) {
                        newH = maxAvailableHeight;
                    }

                    setDims({ w: newW, h: newH });
                }
            }
        };

        const handleMouseUp = () => {
            if (isDragging || isResizing) {
                setIsDragging(false);
                setIsResizing(false);

                if (onUpdate) {
                    onUpdate(id, {
                        x: pos.x,
                        y: pos.y,
                        width: dims.w,
                        height: dims.h
                    });
                }
            }
        };

        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, id, onUpdate, pos, dims, type, panOffset, limit]);

    // Styl kontenera
    const containerStyle = {
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        // Arrow ma width/height 0, żeby kontener nie blokował myszki na ukos
        width: type === 'arrow' ? 0 : dims.w,
        height: type === 'arrow' ? 0 : dims.h,
        cursor: isDragging ? 'grabbing' : (isDrawingTool ? 'default' : 'grab'),
        border: selected && type !== 'arrow' ? '2px dashed #3498db' : 'none',
        zIndex: selected ? 20 : 10,
        boxSizing: 'border-box',
        pointerEvents: 'none', // Kontener zawsze przepuszcza, interakcję łapią dzieci
    };

    const renderShapeContent = () => {
        const commonSvgContainerProps = {
            width: "100%",
            height: "100%",
            viewBox: "0 0 24 24",
            preserveAspectRatio: "none",
            style: { display: 'block', pointerEvents: 'none' }
        };
        const shapeColor = color || 'black';
        // Style sterujące interakcją w zależności od wybranego narzędzia
        const interactableStyle = { pointerEvents: isDrawingTool ? 'none' : 'auto' };
        const strokeStyle = { pointerEvents: isDrawingTool ? 'none' : 'visibleStroke' };

        switch (type) {
            case 'square':
                return <div style={{ width: '100%', height: '100%', background: shapeColor, ...interactableStyle }} />;
            case 'rectangle_outline':
                return (
                    <svg {...commonSvgContainerProps}>
                        {/* Niewidoczna, gruba ramka do łapania myszką */}
                        <rect
                            x="1" y="1" width="22" height="22"
                            fill="none" stroke={shapeColor} strokeWidth="5"
                            style={{
                                pointerEvents: isDrawingTool ? 'none' : 'auto', // Tutaj naprawiamy interakcję
                                cursor: 'pointer'
                            }}
                            vectorEffect="non-scaling-stroke"
                        />
                        {/* Widoczna ramka */}
                        <rect x="1" y="1" width="22" height="22" fill="none" stroke="black" strokeWidth="2" style={{ pointerEvents: 'none' }} vectorEffect="non-scaling-stroke" />
                    </svg>
                );

            case 'circle':
                return <div style={{ width: '100%', height: '100%', background: shapeColor, borderRadius: '50%', ...interactableStyle }} />;
            case 'arrow':
                const strokeWidth = 3;
                const markerSize = 10;

                return (
                    <svg
                        // 🟢 PRZYWRACAMY width="1" height="1" + overflow="visible"
                        // Ponieważ kontener ma wymiary 0x0, ustawienie tu 100% powodowało zniknięcie strzałki.
                        width="1"
                        height="1"
                        style={{
                            overflow: 'visible',
                            pointerEvents: 'none',
                            display: 'block',
                            position: 'absolute',
                            top: 0,
                            left: 0
                        }}
                    >
                        <defs>
                            <marker
                                id={`arrowhead-${id}`}
                                markerWidth={markerSize}
                                markerHeight={markerSize}
                                refX={9}
                                refY={markerSize / 2}
                                orient="auto"
                            >
                                <path
                                    d={`M 0 0 L ${markerSize} ${markerSize / 2} L 0 ${markerSize} Z`}
                                    fill={shapeColor}
                                />
                            </marker>
                        </defs>

                        {/* Gruby duch do chwytania - znika dla myszy przy rysowaniu */}
                        <line
                            x1={0} y1={0} x2={dims.w} y2={dims.h}
                            stroke={shapeColor} strokeWidth={strokeWidth}
                            // 🟢 TUTAJ NAPRAWIAMY RYSOWANIE "PRZEZ" STRZAŁKĘ
                            // Jeśli isDrawingTool -> pointerEvents: none
                            style={{
                                pointerEvents: isDrawingTool ? 'none' : 'auto',
                                cursor: 'grab'
                            }}
                        />
                        <line
                            x1={0} y1={0} x2={dims.w} y2={dims.h}
                            stroke={shapeColor} strokeWidth={strokeWidth}
                            pointerEvents="none"
                            markerEnd={`url(#arrowhead-${id})`}
                        />
                    </svg>
                );

            case 'star': return <svg {...commonSvgContainerProps}><path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.62L12 2L9.19 8.62L2 9.24L7.45 13.97L5.82 21L12 17.27Z" fill="#f1c40f" style={interactableStyle} /></svg>;
            case 'check': return <svg {...commonSvgContainerProps}><polyline points="20 6 9 17 4 12" fill="none" stroke="#2ecc71" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={strokeStyle} /></svg>;
            case 'cross': return <svg {...commonSvgContainerProps}><g style={strokeStyle}><line x1="18" y1="6" x2="6" y2="18" fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><line x1="6" y1="6" x2="18" y2="18" fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g></svg>;
            default: return <div style={{ width: '100%', height: '100%', background: '#ccc', ...interactableStyle }} />;
        }
    };

    return (
        <div
            className="shape-item"
            style={containerStyle}
            onMouseDown={handleMouseDown}
            onClick={(e) => e.stopPropagation()}
        >
            {renderShapeContent()}

            {selected && (
                <>
                    <div
                        className="resize-handle box-handle"
                        onMouseDown={handleResizeStart}
                        style={{
                            position: 'absolute',
                            width: 12,
                            height: 12,
                            background: 'white',
                            border: '1px solid #3498db',
                            borderRadius: type === 'arrow' ? '50%' : '0',
                            zIndex: 21,
                            // Uchwyt zmiany rozmiaru też znika dla myszy przy rysowaniu
                            pointerEvents: isDrawingTool ? 'none' : 'auto',
                            ...(type === 'arrow'
                                ? {
                                    left: dims.w,
                                    top: dims.h,
                                    transform: 'translate(-50%, -50%)',
                                    cursor: 'crosshair'
                                }
                                : {
                                    bottom: -6,
                                    right: -6,
                                    cursor: 'nwse-resize'
                                }
                            )
                        }}
                    />
                </>
            )}
        </div>
    );
};

export default Shape;