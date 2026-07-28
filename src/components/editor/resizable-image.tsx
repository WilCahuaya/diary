"use client";

import { useRef, useState } from "react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";

const MIN_WIDTH = 80;

export function ResizableImageView({
  node,
  updateAttributes,
  selected,
  editor,
}: ReactNodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const editable = editor.isEditable;
  const attrWidth = typeof node.attrs.width === "number" ? node.attrs.width : null;
  const displayWidth = dragWidth ?? attrWidth ?? undefined;

  function startResize(event: React.PointerEvent, corner: "se" | "sw") {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();

    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const startX = event.clientX;
    const startWidth = img.getBoundingClientRect().width;
    const maxWidth = container.parentElement?.clientWidth ?? startWidth;
    const direction = corner === "se" ? 1 : -1;
    let latestWidth = Math.round(startWidth);

    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);

    function onMove(e: PointerEvent) {
      const delta = (e.clientX - startX) * direction;
      latestWidth = Math.round(
        Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth + delta))
      );
      setDragWidth(latestWidth);
    }

    function onUp(e: PointerEvent) {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      setDragWidth(null);
      updateAttributes({ width: latestWidth });
    }

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  return (
    <NodeViewWrapper className="diary-image-node">
      <div
        ref={containerRef}
        className={`diary-image-frame${selected && editable ? " is-selected" : ""}`}
        style={{ width: displayWidth ? `${displayWidth}px` : undefined }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={node.attrs.src as string}
          alt={(node.attrs.alt as string) || ""}
          data-image-id={node.attrs.dataImageId as string | undefined}
          className="diary-inline-image"
          draggable={false}
        />

        {editable && selected && (
          <>
            <button
              type="button"
              aria-label="Redimensionar desde la esquina inferior izquierda"
              className="diary-image-handle diary-image-handle--sw"
              onPointerDown={(e) => startResize(e, "sw")}
            />
            <button
              type="button"
              aria-label="Redimensionar desde la esquina inferior derecha"
              className="diary-image-handle diary-image-handle--se"
              onPointerDown={(e) => startResize(e, "se")}
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}
