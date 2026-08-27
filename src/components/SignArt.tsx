import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Line,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import styled from 'styled-components/native';

import { SignArtSpec, SignSymbol } from '@/data/signs/wire';
import { signColors } from '@/theme';

// Stylised MUTCD sign renderings driven by the `art` specs in the signs
// catalogue.
// Geometric approximations, like the CSS signs in the design reference — swap
// for licensed artwork if the product ships it. Colours are fixed semantics.

// The art vocabulary is part of the signs wire contract, not of this
// renderer: the admin panel builds its pickers from the same lists, and
// `validateSignsDoc` rejects a spec this switch could not draw.
export type { SignArtSpec, SignSymbol } from '@/data/signs/wire';

type StrokeSymbol = {
  d: string;
  heads?: [number, number, number][];
  width?: number;
};

const STROKE_SYMBOLS: Partial<Record<SignSymbol, StrokeSymbol>> = {
  arrowUp: { d: 'M50 84 V26', heads: [[50, 20, 0]] },
  arrowLeft: { d: 'M80 50 H26', heads: [[20, 50, 270]] },
  arrowRight: { d: 'M20 50 H74', heads: [[80, 50, 90]] },
  turnLeft: { d: 'M62 84 V56 Q62 44 50 44 H34', heads: [[28, 44, 270]] },
  turnRight: { d: 'M38 84 V56 Q38 44 50 44 H66', heads: [[72, 44, 90]] },
  curveLeft: { d: 'M60 84 C60 62 40 62 40 42 V30', heads: [[40, 24, 0]] },
  curveRight: { d: 'M40 84 C40 62 60 62 60 42 V30', heads: [[60, 24, 0]] },
  winding: {
    d: 'M54 86 C54 74 42 74 42 62 C42 50 58 52 58 40 C58 30 50 32 50 24',
    heads: [[50, 18, 0]],
  },
  crossroad: { d: 'M50 86 V14 M20 50 H80', width: 12 },
  sideRoad: { d: 'M50 86 V14 M50 50 H82', width: 12 },
  tIntersection: { d: 'M50 86 V50 M18 50 H82', width: 12 },
  fork: {
    d: 'M50 88 V62 M50 62 C50 46 36 50 36 28 M50 62 C50 46 64 50 64 28',
    heads: [
      [36, 22, 0],
      [64, 22, 0],
    ],
  },
  merge: {
    d: 'M36 86 C36 60 48 62 50 30 M64 86 C64 60 52 62 50 30',
    heads: [[50, 24, 0]],
  },
  laneEnds: { d: 'M62 86 V16 M36 86 C36 60 58 62 60 40', width: 9 },
  divided: {
    d: 'M36 86 C36 60 30 52 30 36 M64 86 C64 60 70 52 70 36',
    heads: [
      [30, 30, 0],
      [70, 30, 0],
    ],
  },
  twoWay: {
    d: 'M40 78 V26 M60 22 V74',
    heads: [
      [40, 20, 0],
      [60, 80, 180],
    ],
  },
  uturn: { d: 'M64 82 V48 C64 32 36 32 36 48 V62', heads: [[36, 68, 180]] },
  narrowBridge: {
    d: 'M36 88 C36 66 42 62 42 50 V12 M64 88 C64 66 58 62 58 50 V12',
  },
  softShoulder: { d: 'M40 88 V12 M62 88 C62 62 68 44 68 12' },
  bump: { d: 'M14 66 H36 Q50 42 64 66 H86' },
  dip: { d: 'M14 56 H36 Q50 80 64 56 H86' },
  roundabout: { d: 'M66 46 A16 16 0 1 1 57 31', heads: [[56, 28, 300]] },
};

const ArrowHead: React.FC<{
  at: [number, number, number];
  color: string;
}> = ({ at: [x, y, angle], color }) => (
  <Polygon
    points="0,-11 9,7 -9,7"
    fill={color}
    transform={`translate(${x}, ${y}) rotate(${angle})`}
  />
);

type SymbolArtProps = {
  symbol: SignSymbol;
  size: number;
  color?: string;
};

export const SignSymbolArt: React.FC<SymbolArtProps> = ({
  symbol,
  size,
  color = signColors.ink,
}) => {
  const stroke = STROKE_SYMBOLS[symbol];

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {stroke != null && (
        <>
          <Path
            d={stroke.d}
            stroke={color}
            strokeWidth={stroke.width ?? 8}
            strokeLinecap="round"
            fill="none"
          />
          {stroke.heads?.map(head => (
            <ArrowHead key={head.join(',')} at={head} color={color} />
          ))}
        </>
      )}
      {symbol === 'signal' && (
        <>
          <Rect x={35} y={16} width={30} height={68} rx={9} fill={color} />
          <Circle cx={50} cy={31} r={7.5} fill="#E53935" />
          <Circle cx={50} cy={50} r={7.5} fill="#FDD835" />
          <Circle cx={50} cy={69} r={7.5} fill="#43A047" />
        </>
      )}
      {symbol === 'stopAhead' && (
        <>
          <Polygon
            points="41,14 59,14 72,27 72,45 59,58 41,58 28,45 28,27"
            fill={signColors.regulatory}
          />
          <Line
            x1={50}
            y1={60}
            x2={50}
            y2={88}
            stroke={color}
            strokeWidth={9}
            strokeLinecap="round"
          />
        </>
      )}
      {symbol === 'yieldAhead' && (
        <>
          <Polygon points="29,14 71,14 50,52" fill={signColors.regulatory} />
          <Line
            x1={50}
            y1={58}
            x2={50}
            y2={88}
            stroke={color}
            strokeWidth={9}
            strokeLinecap="round"
          />
        </>
      )}
      {symbol === 'pedestrian' && (
        <>
          <Circle cx={50} cy={21} r={8} fill={color} />
          <Path
            d="M50 32 L50 58 M50 40 L35 50 M50 40 L63 52 M50 58 L37 84 M50 58 L60 84"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
      {symbol === 'bicycle' && (
        <>
          <Circle
            cx={29}
            cy={66}
            r={14}
            stroke={color}
            strokeWidth={6}
            fill="none"
          />
          <Circle
            cx={71}
            cy={66}
            r={14}
            stroke={color}
            strokeWidth={6}
            fill="none"
          />
          <Path
            d="M29 66 L44 42 H60 L71 66 M44 42 L55 66 M60 42 L53 30 H64"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
      {symbol === 'deer' && (
        <>
          <Path
            d="M18 76 Q26 54 42 56 L58 56 Q64 46 72 42 L78 44 Q86 48 84 58 L74 60 L70 76 L63 76 L65 62 L46 62 L42 76 Z"
            fill={color}
          />
          <Path
            d="M74 42 L68 26 M74 42 L82 26"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
          />
        </>
      )}
      {symbol === 'slippery' && (
        <>
          <Path
            d="M34 86 C24 74 44 66 34 52 C28 44 36 40 36 32 M58 86 C48 74 68 66 58 52 C52 44 60 40 60 32"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            fill="none"
          />
          <Rect
            x={54}
            y={14}
            width={28}
            height={13}
            rx={5}
            fill={color}
            transform="rotate(14, 68, 20)"
          />
        </>
      )}
      {symbol === 'hill' && (
        <>
          <Polygon points="12,82 88,82 88,40" fill={color} />
          <Rect
            x={30}
            y={44}
            width={28}
            height={14}
            rx={3}
            fill={color}
            transform="rotate(-16, 44, 51)"
          />
        </>
      )}
      {symbol === 'truck' && (
        <>
          <Rect x={14} y={36} width={44} height={28} rx={3} fill={color} />
          <Path d="M58 64 V44 H74 L86 56 V64 Z" fill={color} />
          <Circle cx={28} cy={70} r={7} fill={color} />
          <Circle cx={66} cy={70} r={7} fill={color} />
          <Circle cx={80} cy={70} r={7} fill={color} />
        </>
      )}
      {symbol === 'workers' && (
        <>
          <Circle cx={40} cy={22} r={8} fill={color} />
          <Path
            d="M40 31 L48 52 L48 80 M48 52 L66 62 M40 31 L34 56 L26 80"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            fill="none"
          />
          <Line
            x1={66}
            y1={62}
            x2={80}
            y2={76}
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
          />
          <Circle cx={82} cy={79} r={5} fill={color} />
        </>
      )}
      {symbol === 'flagger' && (
        <>
          <Circle cx={46} cy={22} r={8} fill={color} />
          <Path
            d="M46 31 V60 M46 60 L36 84 M46 60 L58 84 M46 40 L64 28"
            stroke={color}
            strokeWidth={7}
            strokeLinecap="round"
            fill="none"
          />
          <Rect x={63} y={16} width={18} height={13} fill={color} />
        </>
      )}
      {symbol === 'gas' && (
        <>
          <Rect
            x={28}
            y={22}
            width={34}
            height={54}
            rx={5}
            stroke={color}
            strokeWidth={6}
            fill="none"
          />
          <Rect x={37} y={32} width={16} height={12} fill={color} />
          <Path
            d="M62 38 H72 V64 M24 82 H66"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
    </Svg>
  );
};

const OCTAGON_POINTS = '30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30';

type SignArtProps = {
  art: SignArtSpec;
  size: number;
};

const SignArt: React.FC<SignArtProps> = ({ art, size: s }) => {
  switch (art.kind) {
    case 'octagon':
      return (
        <Box style={{ width: s, height: s }}>
          <Svg
            width={s}
            height={s}
            viewBox="0 0 100 100"
            style={StyleSheet.absoluteFill}
          >
            <Polygon points={OCTAGON_POINTS} fill={signColors.regulatory} />
          </Svg>
          <SignText style={{ fontSize: s * 0.2, color: '#fff' }}>
            {art.label}
          </SignText>
        </Box>
      );
    case 'yield':
      return (
        <View style={{ width: s, height: s, alignItems: 'center' }}>
          <Svg
            width={s}
            height={s}
            viewBox="0 0 100 100"
            style={StyleSheet.absoluteFill}
          >
            <Polygon points="50,100 0,0 100,0" fill={signColors.regulatory} />
          </Svg>
          <SignText
            style={{ fontSize: s * 0.145, color: '#fff', marginTop: s * 0.13 }}
          >
            YIELD
          </SignText>
        </View>
      );
    case 'doNotEnter':
      return (
        <Box
          style={{
            width: s,
            height: s,
            borderRadius: s / 2,
            backgroundColor: signColors.regulatory,
          }}
        >
          <View
            style={{
              width: s * 0.54,
              height: s * 0.125,
              borderRadius: 2,
              backgroundColor: '#fff',
            }}
          />
        </Box>
      );
    case 'whiteRect': {
      const slashHeight = Math.max(3, s * 0.067);
      return (
        <Box
          style={{
            width: s * 0.77,
            height: s,
            backgroundColor: '#fff',
            borderWidth: Math.max(2, s * 0.048),
            borderColor: signColors.ink,
            borderRadius: Math.max(4, s * 0.096),
            paddingHorizontal: 2,
          }}
        >
          {art.lines?.map(line => (
            <SignText
              key={line}
              style={{ fontSize: s * 0.096, color: signColors.ink }}
            >
              {line}
            </SignText>
          ))}
          {art.big != null && (
            <SignText style={{ fontSize: s * 0.27, color: signColors.ink }}>
              {art.big}
            </SignText>
          )}
          {art.symbol != null && (
            <SignSymbolArt symbol={art.symbol} size={s * 0.52} />
          )}
          {art.slash === true && (
            <Slash
              style={{
                width: s * 0.8,
                height: slashHeight,
                borderRadius: slashHeight / 2,
              }}
            />
          )}
        </Box>
      );
    }
    case 'redRing': {
      const slashHeight = Math.max(3, s * 0.067);
      return (
        <Box
          style={{
            width: s,
            height: s,
            borderRadius: s / 2,
            backgroundColor: '#fff',
            borderWidth: Math.max(3, s * 0.067),
            borderColor: signColors.regulatory,
          }}
        >
          <SignSymbolArt symbol={art.symbol} size={s * 0.56} />
          <Slash
            style={{
              width: s * 0.82,
              height: slashHeight,
              borderRadius: slashHeight / 2,
            }}
          />
        </Box>
      );
    }
    case 'yellowDiamond':
    case 'orangeDiamond': {
      const fill =
        art.kind === 'yellowDiamond' ? signColors.warning : signColors.workzone;
      return (
        <Box style={{ width: s, height: s }}>
          <View
            style={{
              position: 'absolute',
              width: s * 0.72,
              height: s * 0.72,
              borderRadius: Math.max(3, s * 0.08),
              backgroundColor: fill,
              borderWidth: Math.max(1.5, s * 0.02),
              borderColor: signColors.ink,
              transform: [{ rotate: '45deg' }],
            }}
          />
          {art.symbol != null && (
            <SignSymbolArt symbol={art.symbol} size={s * 0.52} />
          )}
          {art.symbol == null && art.label != null && (
            <SignText
              style={{
                fontSize: s * 0.105,
                color: signColors.ink,
                maxWidth: s * 0.62,
              }}
            >
              {art.label.toUpperCase()}
            </SignText>
          )}
        </Box>
      );
    }
    case 'orangeRect':
      return (
        <Box style={{ width: s, height: s }}>
          <Box
            style={{
              width: s,
              height: s * 0.55,
              borderRadius: Math.max(3, s * 0.06),
              backgroundColor: signColors.workzone,
              borderWidth: Math.max(1.5, s * 0.02),
              borderColor: signColors.ink,
            }}
          >
            {art.lines.map(line => (
              <SignText
                key={line}
                style={{ fontSize: s * 0.115, color: signColors.ink }}
              >
                {line}
              </SignText>
            ))}
          </Box>
        </Box>
      );
    case 'blueRect':
      return (
        <Box style={{ width: s, height: s }}>
          <Box
            style={{
              width: s * 0.85,
              height: s * 0.85,
              borderRadius: Math.max(3, s * 0.08),
              backgroundColor: signColors.guide,
            }}
          >
            {art.big != null ? (
              <SignText style={{ fontSize: s * 0.42, color: '#fff' }}>
                {art.big}
              </SignText>
            ) : (
              <SignText
                style={{
                  fontSize: s * 0.115,
                  color: '#fff',
                  maxWidth: s * 0.72,
                }}
              >
                {art.label.toUpperCase()}
              </SignText>
            )}
          </Box>
        </Box>
      );
    case 'greenRect':
    case 'greenExit':
      return (
        <Box style={{ width: s, height: s }}>
          <Box
            style={{
              width: s,
              height: s * 0.6,
              borderRadius: Math.max(3, s * 0.06),
              backgroundColor: signColors.highway,
              borderWidth: Math.max(1, s * 0.02),
              borderColor: '#fff',
              paddingHorizontal: 3,
            }}
          >
            {art.kind === 'greenExit' && (
              <SignText style={{ fontSize: s * 0.09, color: '#fff' }}>
                EXIT
              </SignText>
            )}
            {art.lines.map(line => (
              <SignText
                key={line}
                style={{ fontSize: s * 0.105, color: '#fff' }}
              >
                {line}
              </SignText>
            ))}
          </Box>
        </Box>
      );
    case 'shield':
      return (
        <Box style={{ width: s, height: s }}>
          <Svg
            width={s}
            height={s}
            viewBox="0 0 100 100"
            style={StyleSheet.absoluteFill}
          >
            <Path
              d="M50 4 C62 12 80 14 94 12 C96 40 88 74 50 96 C12 74 4 40 6 12 C20 14 38 12 50 4 Z"
              fill={signColors.guide}
              stroke="#fff"
              strokeWidth={3}
            />
            <Path
              d="M50 4 C62 12 80 14 94 12 C94.4 16.5 94.4 21 94 25 L6 25 C5.6 21 5.6 16.5 6 12 C20 14 38 12 50 4 Z"
              fill={signColors.regulatory}
            />
          </Svg>
          <SignText
            style={{ fontSize: s * 0.3, color: '#fff', marginTop: s * 0.16 }}
          >
            {art.label}
          </SignText>
        </Box>
      );
    case 'pentagon':
      return (
        <Box style={{ width: s, height: s }}>
          <Svg
            width={s}
            height={s}
            viewBox="0 0 100 100"
            style={StyleSheet.absoluteFill}
          >
            <Polygon
              points="50,2 98,40 89,98 11,98 2,40"
              fill={signColors.school}
              stroke={signColors.ink}
              strokeWidth={2.5}
            />
          </Svg>
          <View style={{ marginTop: s * 0.14 }}>
            <SignSymbolArt symbol="pedestrian" size={s * 0.5} />
          </View>
        </Box>
      );
    case 'yellowCircle':
      return (
        <Box
          style={{
            width: s,
            height: s,
            borderRadius: s / 2,
            backgroundColor: signColors.warning,
            borderWidth: Math.max(1.5, s * 0.02),
            borderColor: signColors.ink,
          }}
        >
          <Svg
            width={s}
            height={s}
            viewBox="0 0 100 100"
            style={StyleSheet.absoluteFill}
          >
            <Path
              d="M32 32 L68 68 M68 32 L32 68"
              stroke={signColors.ink}
              strokeWidth={7}
              strokeLinecap="round"
            />
            <SvgText
              x={17}
              y={58}
              fontSize={22}
              fontWeight="800"
              fill={signColors.ink}
              textAnchor="middle"
            >
              R
            </SvgText>
            <SvgText
              x={83}
              y={58}
              fontSize={22}
              fontWeight="800"
              fill={signColors.ink}
              textAnchor="middle"
            >
              R
            </SvgText>
          </Svg>
        </Box>
      );
    case 'pennant':
      return (
        <Box style={{ width: s, height: s, alignItems: 'flex-start' }}>
          <Svg
            width={s}
            height={s}
            viewBox="0 0 100 100"
            style={StyleSheet.absoluteFill}
          >
            <Polygon
              points="2,18 98,50 2,82"
              fill={signColors.warning}
              stroke={signColors.ink}
              strokeWidth={2.5}
            />
          </Svg>
          <SignText
            style={{
              fontSize: s * 0.085,
              color: signColors.ink,
              maxWidth: s * 0.5,
              marginLeft: s * 0.06,
              marginTop: s * 0.38,
            }}
          >
            {art.label.toUpperCase()}
          </SignText>
        </Box>
      );
    default:
      return <View style={{ width: s, height: s }} />;
  }
};

const Box = styled.View`
  align-items: center;
  justify-content: center;
`;

const SignText = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  text-align: center;
  letter-spacing: 0.5px;
`;

const Slash = styled.View`
  position: absolute;
  background-color: ${signColors.regulatory};
  transform: rotate(-45deg);
`;

export default SignArt;
