"use client";

import Image from "next/image";
import { memo } from "react";

import { Card as CardBase } from "@heroui/react";

export interface CardProps {
  title: string;
  description?: string | null;
  imageSrc?: string | null;
  imageAlt?: string;
  onPress?: () => void;
  isDisabled?: boolean;
}

const Card = memo<CardProps>(
  ({
    title,
    description,
    imageSrc,
    imageAlt = title,
    onPress,
    isDisabled = false,
  }) => {
    const handleClick = () => {
      if (!isDisabled && onPress) {
        onPress();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !isDisabled && onPress) {
        e.preventDefault();
        onPress();
      }
    };

    return (
      <CardBase
        className="group focus-visible:ring-primary relative min-h-[250px] w-full cursor-pointer transition-[box-shadow] duration-200 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
        variant="default"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={onPress && !isDisabled ? 0 : undefined}
        role={onPress ? "button" : undefined}
        aria-disabled={isDisabled}
        aria-label={`Choose ${title}`}>
        <div className="absolute inset-0 flex h-60 justify-center overflow-hidden rounded-t-xl p-0">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, #000 10%, transparent 100%)",
              }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div
              className="from-primary/10 via-secondary/10 to-tertiary/10 flex h-full w-full items-center justify-center bg-gradient-to-br transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, #000 10%, transparent 100%)",
              }}>
              <div className="bg-primary/20 flex size-24 items-center justify-center rounded-2xl backdrop-blur-sm">
                <span
                  className="text-primary text-5xl font-semibold"
                  aria-hidden="true">
                  {title.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>

        <CardBase.Header className="absolute bottom-0 w-full px-0 pt-4 pb-8">
          <div className="flex flex-col items-start justify-end gap-2">
            <CardBase.Title className="line-clamp-1 text-lg">
              {title}
            </CardBase.Title>
            {description && (
              <CardBase.Description className="text-small line-clamp-2">
                {description}
              </CardBase.Description>
            )}
          </div>
        </CardBase.Header>
      </CardBase>
    );
  }
);

export default Card;
