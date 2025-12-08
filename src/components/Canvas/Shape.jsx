import React, { useState, useEffect, useRef } from 'react';

const Shape = ({ id, x, y, width, height, type, selected, onSelect, onUpdate }) => {
    // Domyślne wymiary jeśli nie podano
    const [dims, setDims] = useState({
        w: width || 100,
        h: height || 100
    });

    const [pos, setPos] = useState({ x, y });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    // Referencje do obliczeń przesunięcia
    const dragStartRef = useRef({ x: 0, y: 0 }); // Gdzie kliknęliśmy myszką
    const initialPosRef = useRef({ x: 0, y: 0 }); // Gdzie był obiekt
    const initialDimsRef = useRef({ w: 0, h: 0 }); // Jaki miał rozmiar

    // Synchronizacja z propsami (gdy inny użytkownik przesuwa)
    useEffect(() => {
        if (!isDragging && !isResizing) {
            setPos({ x, y });
            setDims({ w: width || 100, h: height || 100 });
        }
    }, [x, y, width, height, isDragging, isResizing]);

    // --- LOGIKA PRZESUWANIA (DRAG) ---
    const handleMouseDown = (e) => {
        e.stopPropagation(); // Nie rysuj na canvasie pod spodem
        onSelect(id);

        // Jeśli kliknęliśmy w uchwyt zmiany rozmiaru, nie zaczynaj przesuwania
        if (e.target.closest('.resize-handle')) return;

        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialPosRef.current = { x: pos.x, y: pos.y };
    };

    // --- LOGIKA SKALOWANIA (RESIZE) ---
    const handleResizeStart = (e, direction) => {
        e.stopPropagation();
        setIsResizing(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialDimsRef.current = { w: dims.w, h: dims.h };
        initialPosRef.current = { x: pos.x, y: pos.y }; // Potrzebne przy skalowaniu w lewo/górę
    };

    // --- GLOBALNE LISTENERY MYSZY ---
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                const dx = e.clientX - dragStartRef.current.x;
                const dy = e.clientY - dragStartRef.current.y;

                setPos({
                    x: initialPosRef.current.x + dx,
                    y: initialPosRef.current.y + dy
                });
            }

            if (isResizing) {
                const dx = e.clientX - dragStartRef.current.x;
                const dy = e.clientY - dragStartRef.current.y;

                // Prostokątne skalowanie (zwiększanie width/height)
                // Dla uproszczenia tutaj skalujemy tylko prawy dolny róg (typowe zachowanie webowe)
                // Jeśli chcesz pełne skalowanie (z każdego rogu), logika jest bardziej złożona.
                // Poniżej wersja dla uchwytu "bottom-right":

                const newW = Math.max(20, initialDimsRef.current.w + dx);
                const newH = Math.max(20, initialDimsRef.current.h + dy);

                setDims({ w: newW, h: newH });
            }
        };

        const handleMouseUp = () => {
            if (isDragging || isResizing) {
                setIsDragging(false);
                setIsResizing(false);

                // Wyślij aktualizację do serwera/rodzica PO zakończeniu akcji
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
    }, [isDragging, isResizing, id, onUpdate, pos, dims]); // Dependencies

    // Styl kontenera
    const containerStyle = {
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: dims.w,
        height: dims.h,
        cursor: isDragging ? 'grabbing' : 'grab',
        border: selected ? '2px dashed #3498db' : 'none',
        zIndex: selected ? 100 : 10,
        boxSizing: 'border-box',
        pointerEvents: 'none', // <--- Myszka ignoruje kontener
    };

    // Renderowanie zawartości (skalowanie SVG do 100%)
    const renderShapeContent = () => {
        const commonSvgContainerProps = {
            width: "100%",
            height: "100%",
            viewBox: "0 0 24 24",
            preserveAspectRatio: "none", // Pozwala rozciągać kształty nienaturalnie (jak w Paincie)
            style: { display: 'block', pointerEvents: 'none' } // Usuwa dolny margines SVG
        };

        const interactableStyle = { pointerEvents: 'auto' }; // Dla pełnych kształtów
        const strokeStyle = { pointerEvents: 'visibleStroke' }; // Dla samych linii

        switch (type) {
            // 1) Pełny kwadrat - cały klikalny
            case 'square':
                return <div style={{ width: '100%', height: '100%', background: 'black', ...interactableStyle }} />;

            // 2) Obrys (pusty w środku) - używamy SVG Rect z fill="none"
            case 'rectangle_outline':
                return (
                    <svg {...commonSvgContainerProps}>
                        {/* WARSTWA 1: Niewidzialny, gruby "łapacz" kliknięć */}
                        <rect
                            x="1" y="1" width="22" height="22"
                            fill="none"
                            stroke="transparent" /* Niewidoczny */
                            strokeWidth="15"     /* Bardzo gruby obszar kliknięcia */
                            style={{ pointerEvents: 'visibleStroke', cursor: 'pointer' }} /* To on reaguje na myszkę */
                            vectorEffect="non-scaling-stroke"
                        />

                        {/* WARSTWA 2: Widoczny, cienki kontur */}
                        <rect
                            x="1" y="1" width="22" height="22"
                            fill="none"
                            stroke="black"
                            strokeWidth="2" /* Tutaj ustawiasz wygląd wizualny (np. 1 lub 2) */
                            style={{ pointerEvents: 'none' }} /* Ignoruje myszkę, przepuszcza do warstwy 1 */
                            vectorEffect="non-scaling-stroke"
                        />
                    </svg>
                );

            // 4) Koło (pełne)
            case 'circle':
                return <div style={{ width: '100%', height: '100%', background: 'black', borderRadius: '50%', ...interactableStyle }} />;

            // 3) Strzałka
            case 'arrow':
                return (
                    <svg {...commonSvgContainerProps}>
                        <path d="M12 2L2 22L12 18L22 22L12 2Z" fill="black" style={interactableStyle} />
                    </svg>
                );

            // 5) Gwiazda
            case 'star':
                return (
                    <svg {...commonSvgContainerProps}>
                        <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.62L12 2L9.19 8.62L2 9.24L7.45 13.97L5.82 21L12 17.27Z" fill="#f1c40f" style={interactableStyle} />
                    </svg>
                );

            // 6) Check (same linie)
            case 'check':
                return (
                    <svg {...commonSvgContainerProps}>
                        <polyline points="20 6 9 17 4 12" fill="none" stroke="#2ecc71" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={strokeStyle} />
                    </svg>
                );

            // 7) Krzyżyk (same linie)
            case 'cross':
                return (
                    <svg {...commonSvgContainerProps}>
                        <g style={strokeStyle}>
                            <line x1="18" y1="6" x2="6" y2="18" fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="6" y1="6" x2="18" y2="18" fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                    </svg>
                );

            default:
                return <div style={{ width: '100%', height: '100%', background: '#ccc', ...interactableStyle }} />;
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
                <div
                    className="resize-handle"
                    onMouseDown={(e) => handleResizeStart(e, 'se')}
                    style={{
                        position: 'absolute',
                        bottom: -6,
                        right: -6,
                        width: 12,
                        height: 12,
                        background: 'white',
                        border: '1px solid #3498db',
                        borderRadius: '50%',
                        cursor: 'nwse-resize',
                        zIndex: 101,
                        pointerEvents: 'auto' // <--- Uchwyt zawsze musi być klikalny!
                    }}
                />
            )}
        </div>
    );
};


export default Shape;