type PresetIconProps = {
  src: string;
  alt: string;
  size?: number;
  className?: string;
};

/**
 * Renders a preset SVG icon masked with the active theme's accent colour
 * (`rgb(var(--accent))`). The icon adapts automatically on theme switch.
 */
export default function PresetIcon({ src, alt, size = 32, className = '' }: PresetIconProps) {
  return (
    <span
      role="img"
      aria-label={alt}
      className={`block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: 'rgb(var(--accent))',
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}
