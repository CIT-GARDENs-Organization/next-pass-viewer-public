// app/themes/index.ts
// テーマ毎に「20分前クラス」「15分前クラス」「LOSクラス」「音源パス」などを定義。
// 必要に応じて拡張(例えば複数音源パターン等)してください。

export type ThemeKey = "default";
// ↑テーマ名は好きに増やす

// ステージ名をまとめた型(必要なものを列挙)
type AlertStage = "twentyMin" | "fifteenMin" | "los";

// 1テーマの定義
interface ThemeDefinition {
    // ステージごとに適用するCSSクラス名
    classes: Record<AlertStage, string>;

    // 音源パス(ステージ別に音源を変える場合は Record<AlertStage, string> にする)
    audioSrcFifteenMin: string;
    audioSrcTwentyMin?: string;
    audioSrcLos?: string;

    // テーマ表示名やメタ情報など、追加自由
    // displayName: string;
}

// テーマ一覧
export const THEMES: Record<ThemeKey, ThemeDefinition> = {
    default: {
        classes: {
            twentyMin: "alert-20min-default",
            fifteenMin: "alert-15min-default",
            los: "alert-los-default",
        },
        audioSrcFifteenMin: "",
    }
};
