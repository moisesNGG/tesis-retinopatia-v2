import React from 'react';
import { Button } from '../ui/button';
import { ArrowRight, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

const Hero = ({ title, subtitle, image, imageStyle = "cover", ctaText = "Comenzar Análisis", ctaLink = "/proceso" }) => {
  // Determinar clases CSS según el estilo
  const getImageClasses = () => {
    switch(imageStyle) {
      case 'contain':
        return 'w-full h-full object-contain';
      case 'original':
        return 'w-full h-auto';
      case 'cover':
      default:
        return 'w-full h-full object-cover';
    }
  };
  return (
    <section className="relative bg-gradient-to-br from-blue-50 via-white to-blue-50/30 py-10 md:py-16 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="inline-block">
              <span className="text-xs font-semibold px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                Inteligencia Artificial Médica
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-xl">
                {subtitle}
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to={ctaLink}>
                <Button size="default" className="gap-2 shadow-lg hover:shadow-xl transition-shadow">
                  {ctaText}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/modelo">
                <Button variant="outline" size="default" className="gap-2 shadow-sm hover:shadow-md transition-shadow">
                  <Eye className="h-4 w-4" />
                  Ver Modelo
                </Button>
              </Link>
            </div>
          </div>

          {image && (
            <div className="relative lg:pl-8 overflow-hidden">
              <div className={`relative ${imageStyle === 'original' ? '' : 'aspect-[4/3]'} rounded-xl overflow-hidden shadow-2xl border border-gray-200 bg-gray-50 flex items-center justify-center`}>
                <img
                  src={image}
                  alt={title}
                  className={getImageClasses()}
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/10 to-transparent pointer-events-none" />
              </div>
              <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-400/20 rounded-full blur-3xl -z-10" />
              <div className="absolute top-0 left-0 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl -z-10" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Hero;
