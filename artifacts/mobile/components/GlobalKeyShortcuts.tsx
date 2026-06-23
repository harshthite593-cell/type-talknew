import { router } from "expo-router";
import React, { useRef } from "react";
import { StyleSheet, TextInput } from "react-native";

interface Props {
  extras?: Record<string, () => void>;
}

export default function GlobalKeyShortcuts({ extras = {} }: Props) {
  const ref = useRef<TextInput>(null);

  return (
    <TextInput
      ref={ref}
      style={s.hidden}
      autoFocus
      autoCorrect={false}
      autoCapitalize="none"
      blurOnSubmit={false}
      onChangeText={(t) => {
        if (!t.endsWith("\n")) return;
        const cmd = t.slice(0, -1).trim().toLowerCase();

        if (extras[cmd]) {
          extras[cmd]();
          ref.current?.clear();
          return;
        }

        switch (cmd) {
          case "h":
            router.replace("/");
            break;
          case "e":
            router.push("/emergency");
            break;
          case "b":
            router.back();
            break;
        }
        ref.current?.clear();
      }}
    />
  );
}

const s = StyleSheet.create({
  hidden: {
    position: "absolute",
    width: 0,
    height: 0,
    opacity: 0,
  },
});
