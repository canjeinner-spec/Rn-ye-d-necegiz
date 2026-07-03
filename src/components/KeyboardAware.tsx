import { KeyboardAvoidingView, type KeyboardAvoidingViewProps, StyleSheet } from "react-native";

type Props = KeyboardAvoidingViewProps & {
  /** Üstteki sabit başlık/inset için ek kaydırma (keyboardVerticalOffset). */
  offset?: number;
};

/**
 * Klavye açıldığında input'ların üstte kalmasını sağlayan paylaşılan sarmalayıcı.
 *
 * Neden: Expo SDK 54 ile Android'de edge-to-edge varsayılan; pencere artık
 * klavye için resize edilmiyor. Bu yüzden `behavior={undefined}` olan eski
 * KeyboardAvoidingView Android'de hiçbir şey yapmıyor ve input klavyenin altında
 * kalıyor. Her iki platformda da `behavior="padding"` kullanarak JS taraflı
 * kaçınma yapıyoruz (Expo Go uyumlu, ekstra native paket gerekmez). Bir ekranda
 * ince ayar gerekirse `behavior`/`offset` prop'larıyla override edilebilir.
 */
export function KeyboardAware({ children, style, behavior = "padding", offset = 0, ...rest }: Props) {
  return (
    <KeyboardAvoidingView style={style ?? styles.flex} behavior={behavior} keyboardVerticalOffset={offset} {...rest}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
