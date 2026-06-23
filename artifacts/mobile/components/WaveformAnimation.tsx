import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface WaveformAnimationProps {
  isActive: boolean;
  color: string;
  barCount?: number;
}

export default function WaveformAnimation({
  isActive,
  color,
  barCount = 20,
}: WaveformAnimationProps) {
  const animations = useRef<Animated.Value[]>(
    Array.from({ length: barCount }, () => new Animated.Value(0.15))
  ).current;

  useEffect(() => {
    if (!isActive) {
      animations.forEach((anim) => {
        Animated.spring(anim, {
          toValue: 0.15,
          useNativeDriver: true,
        }).start();
      });
      return;
    }

    const loopingAnimations = animations.map((anim, i) => {
      const delay = (i * 60) % 400;
      const duration = 350 + Math.floor(Math.random() * 300);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 0.2 + Math.random() * 0.8,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.1 + Math.random() * 0.3,
            duration,
            useNativeDriver: true,
          }),
        ])
      );
    });

    loopingAnimations.forEach((a) => a.start());

    return () => {
      loopingAnimations.forEach((a) => a.stop());
    };
  }, [isActive]);

  return (
    <View style={styles.container}>
      {animations.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              opacity: 0.7 + i * 0.015,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    gap: 3,
  },
  bar: {
    width: 3,
    height: 40,
    borderRadius: 2,
  },
});
