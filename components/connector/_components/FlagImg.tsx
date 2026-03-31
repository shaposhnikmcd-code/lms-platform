interface Props {
  code: string;
  width?: number;
  height?: number;
}

export default function FlagImg({ code, width = 24, height = 18 }: Props) {
  return (
    <img
      src={`https://flagcdn.com/${width}x${height}/${code.toLowerCase()}.png`}
      alt={code}
      width={width}
      height={height}
      style={{ display: 'inline-block', borderRadius: '2px', objectFit: 'cover', flexShrink: 0 }}
    />
  );
}