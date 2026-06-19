import { type ReactNode } from "react";
import Svg, { Path } from "react-native-svg";

import { I, type IconName } from "./paths";

/**
 * Web mockup'taki `Ic` bileşeninin RN karşılığı (react-native-svg).
 * `name` ile path sözlüğünden çizer; `path` ile ham d verilebilir;
 * `children` ile özel svg elemanları geçilebilir.
 */
type IconProps = {
  name?: IconName;
  path?: string;
  size?: number;
  /** strokeWidth — mockup'taki `sw` (default 1.7) */
  sw?: number;
  color?: string;
  fill?: string;
  children?: ReactNode;
};

export function Icon({ name, path, size = 20, sw = 1.7, color = "#F4F2EE", fill = "none", children }: IconProps) {
  const d = path ?? (name ? I[name] : undefined);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d ? <Path d={d} /> : children}
    </Svg>
  );
}
