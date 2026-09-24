"use client";

import { Button } from "@/src/app/components/ui/button";
import { cn } from "@/src/app/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const slides = [
  {
    id: 1,
    title: "SALE",
    subtitle: "FLAT 25% OFF | 50% OFF",
    description: "Shop the latest collection for the festive season",
    cta: "Shop Now",
    image: "",
    link: "/sale",
    bgColor: "bg-red-600",
  },
  {
    id: 2,
    title: "NEW ARRIVALS",
    subtitle: "Summer Collection 2025",
    description: "Discover the latest trends for the season",
    cta: "Explore",
    image: "",
    link: "/new-arrivals",
    bgColor: "bg-blue-600",
  },
  {
    id: 3,
    title: "WINTER WEAR",
    subtitle: "Stay Warm in Style",
    description: "Premium winter collection for all ages",
    cta: "Shop Collection",
    image: "",
    link: "/winter-wear",
    bgColor: "bg-gray-800",
  },
];

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative mb-12 overflow-hidden">
      <div className="relative h-[400px] md:h-[500px] lg:h-[600px]">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={cn(
              "absolute inset-0 flex h-full w-full items-center transition-opacity duration-1000",
              currentSlide === index ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            <div className={cn("absolute inset-0", slide.bgColor)}>
              <Image
                src={slide.image || "/placeholder.svg"}
                alt={slide.title}
                fill
                className="object-cover opacity-80"
                preload={index === 0}
              />
            </div>
            <div className="relative z-10 mx-auto px-4 text-white">
              <div className="max-w-lg">
                <h2 className="mb-2 text-4xl font-bold md:text-5xl lg:text-6xl">{slide.title}</h2>
                <p className="mb-4 text-xl font-semibold md:text-2xl">{slide.subtitle}</p>
                <p className="mb-6 text-lg">{slide.description}</p>
                <Link href={slide.link}>
                  <Button size="lg" className="bg-white text-black hover:bg-gray-100">
                    {slide.cta}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-all hover:bg-black/50"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-all hover:bg-black/50"
        aria-label="Next slide"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Indicators */}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 space-x-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={cn(
              "h-2 w-8 rounded-full transition-all",
              currentSlide === index ? "bg-white" : "bg-white/50 hover:bg-white/75"
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
