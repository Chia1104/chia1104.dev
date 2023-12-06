"use server";

import { type FC, type CSSProperties } from "react";

interface Props {
  /**
   * @deprecated
   */
  src?: string;
  metadata?: {
    title?: string | null;
    excerpt?: string | null;
    subtitle?: string | null;
    /**
     * @deprecated
     */
    name?: string;
    /**
     * @deprecated
     */
    url?: string;
  };
  styles?: {
    backgroundImage?: string;
    filter?: CSSProperties;
    title?: CSSProperties;
    expert?: CSSProperties;
    subtitle?: CSSProperties;
  };
}

const OG: FC<Props> = ({ metadata, styles }) => {
  const titleStyle =
    styles?.title?.color === "transparent"
      ? {
          backgroundImage:
            styles?.title?.backgroundImage ??
            "linear-gradient(90deg, rgb(121, 40, 202), rgb(255, 0, 128))",
          backgroundClip: styles?.title?.backgroundClip ?? "text",
          "-webkit-background-clip": "text",
          color: "transparent",
          ...styles?.title,
        }
      : {
          color: styles?.title?.color ?? "black",
          ...styles?.title,
        };
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        flexDirection: "column",
        backgroundImage:
          styles?.backgroundImage ??
          "linear-gradient(217deg, #dbf4ff, #fff1f1), radial-gradient(circle at 25px 25px, lightgray 2%, transparent 0%), radial-gradient(circle at 75px 75px, lightgray 2%, transparent 0%)",
        textAlign: "start",
        position: "relative",
        zIndex: -2,
      }}>
      <div
        style={{
          height: "20px",
          top: 0,
          left: 0,
          width: "100%",
          backgroundImage:
            "linear-gradient(90deg, rgb(121, 40, 202), rgb(255, 0, 128))",
          position: "absolute",
          zIndex: 2,
        }}
      />
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          textAlign: "center",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          flexWrap: "nowrap",
          backgroundColor: "transparent",
          backgroundImage:
            "radial-gradient(circle at 25px 25px, lightgray 2%, transparent 0%), radial-gradient(circle at 75px 75px, lightgray 2%, transparent 0%)",
          backgroundSize: "100px 100px",
          position: "absolute",
          zIndex: -1,
        }}
      />
      {styles?.filter && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backdropFilter: styles.filter?.backdropFilter ?? "blur(4px)",
            backgroundColor: styles.filter?.backgroundColor ?? "black",
            opacity: styles.filter?.opacity ?? 0.1,
            zIndex: 1,
            ...styles.filter,
          }}
        />
      )}
      <h1
        style={{
          fontSize: styles?.title?.fontSize ?? 60,
          fontWeight: 900,
          marginLeft: 80,
          marginRight: 80,
          lineHeight: 1.1,
          ...titleStyle,
        }}>
        <b>{metadata?.title?.slice(0, 50)}</b>
      </h1>
      <p
        style={{
          fontSize: 30,
          color: "darkgray",
          marginLeft: 80,
          marginRight: 80,
          ...styles?.expert,
        }}>
        {metadata?.excerpt?.slice(0, 100)}
      </p>
      <p
        style={{
          fontSize: 20,
          color: "gray",
          marginLeft: 80,
          marginRight: 80,
          marginBottom: 80,
          ...styles?.subtitle,
        }}>
        {metadata?.subtitle}
      </p>
    </div>
  );
};

export default OG;
