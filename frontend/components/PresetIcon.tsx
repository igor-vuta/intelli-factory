type PresetIconProps = {
  src: string;
  alt: string;
  size?: number;
  className?: string;
};

export default function PresetIcon({ src, alt, size = 32, className = '' }: PresetIconProps) {
  return (
    <span
      role={alt ? 'img' : undefined}
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
      className={`block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: 'currentColor',
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
