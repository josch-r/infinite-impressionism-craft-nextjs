"use client";
import { Element, PlacedElement } from "@/interfaces/element";
import { defaultElement } from "../constants/default-element";
import { ElementCardDraggableWrapper } from "./element-card";
import { RotateCcw, Trash } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import ChangeThemeButton from "./change-theme-button";
import Image from "next/image";

export const PlaygroundArea = ({
  placedElements,
  setPlacedElements,
  setElements,
  isLoading,
}: {
  placedElements: PlacedElement[];
  setPlacedElements: (v: PlacedElement[]) => void;
  setElements: (v: Element[]) => void;
  isLoading: boolean;
}) => {
  const onClearPlacedElements = () => {
    setPlacedElements([]);
  };

  const onClearElements = () => {
    const userConfirmed = window.confirm(
      "Are you sure you want clear all the progress? ***You won't be able to recover them again***"
    );
    if (userConfirmed) {
      onClearPlacedElements();
      setElements(defaultElement);
    }
  };

  const { setNodeRef } = useDroppable({
    id: "playground-area",
    data: {
      type: "playground",
    },
    disabled: isLoading,
  });

  return (
    <div className="col-span-9 h-full w-full relative" ref={setNodeRef}>
      {placedElements.map((element, index) => (
        <ElementCardDraggableWrapper
          key={index}
          element={element}
          isLoading={isLoading}
        />
      ))}
      <div
        className="absolute top-0 right-0 p-4 cursor-pointer hover:text-red-400"
        onClick={onClearPlacedElements}
      >
        <Trash />
      </div>
      <div
        className="absolute bottom-0 left-0 p-4 cursor-pointer hover:text-red-400"
        onClick={onClearElements}
      >
        <RotateCcw />
      </div>
      <div className="absolute top-0 left-0 p-4 cursor-pointer">
        <ChangeThemeButton />
      </div>
    </div>
  );
};
