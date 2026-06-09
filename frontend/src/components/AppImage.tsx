import type { ImgHTMLAttributes } from 'react';

interface AppImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fill?: boolean;
}

export default function AppImage({
  fill,
  style,
  width,
  height,
  ...props
}: AppImageProps) {
  return (
    <img
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={
        fill
          ? {
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              ...style,
            }
          : style
      }
      {...props}
    />
  );
}
