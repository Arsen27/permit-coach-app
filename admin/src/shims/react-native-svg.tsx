import React, { useMemo } from 'react';

// Web stand-in for react-native-svg. Its element API mirrors SVG itself, so
// each export is the matching DOM element with props passed straight through
// (React DOM already understands the camelCase attribute names).

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };

const svgElement =
  (tag: string): React.FC<AnyProps> =>
  ({ children, ...props }) =>
    React.createElement(tag, props, children);

export const Circle = svgElement('circle');
export const Ellipse = svgElement('ellipse');
export const G = svgElement('g');
export const Line = svgElement('line');
export const Path = svgElement('path');
export const Polygon = svgElement('polygon');
export const Polyline = svgElement('polyline');
export const Rect = svgElement('rect');
export const Text = svgElement('text');
export const TSpan = svgElement('tspan');
export const Defs = svgElement('defs');
export const LinearGradient = svgElement('linearGradient');
export const RadialGradient = svgElement('radialGradient');
export const Stop = svgElement('stop');
export const ClipPath = svgElement('clipPath');
export const Mask = svgElement('mask');
export const Use = svgElement('use');

type SvgXmlProps = {
  xml: string | null;
  width?: number | string;
  height?: number | string;
  // Icons are tinted by passing a colour the SVG picks up through
  // `currentColor`; callers may also watch for a decode failure.
  color?: string;
  onError?: () => void;
  style?: React.CSSProperties;
};

// Course artwork arrives as an XML string. The importer already rejects
// scripts, foreignObject and external references, so the markup is ours and is
// injected as-is — resized to fill its wrapper the way the native renderer
// scales it.
export const SvgXml: React.FC<SvgXmlProps> = ({
  xml,
  width = '100%',
  height = '100%',
  color,
  style,
}) => {
  const markup = useMemo(() => {
    if (xml == null) {
      return '';
    }
    return xml.replace(
      /<svg([^>]*)>/,
      (_match, attrs: string) =>
        `<svg${attrs
          .replace(/\swidth="[^"]*"/, '')
          .replace(
            /\sheight="[^"]*"/,
            '',
          )} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`,
    );
  }, [xml]);

  if (xml == null) {
    return null;
  }

  return (
    <div
      style={{ width, height, display: 'flex', color, ...style }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
};

const Svg: React.FC<AnyProps> = ({ children, ...props }) =>
  React.createElement(
    'svg',
    { xmlns: 'http://www.w3.org/2000/svg', ...props },
    children,
  );

export default Svg;
