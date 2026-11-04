"use client";

import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = "", onClick, ...rest }: CardProps) {
  return (
    <div {...rest} className={cn("card", onClick && "cursor-pointer", className)} onClick={onClick}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("card-header", className)}>{children}</div>;
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("card-body", className)}>{children}</div>;
}

export function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("card-title", className)}>{children}</div>;
}

export function CardSubtitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("card-sub", className)}>{children}</div>;
}
