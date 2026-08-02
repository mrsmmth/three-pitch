# THREE PITCH

コードと主旋律の1音を選ぶだけで、三和音内の最短ハモを1音返すPWAです。

## 判定
- 本命：基本三和音のみで最短判定
- 表示名：上3度（下5度）
- 「もしかして？」：本命以外のコード構成音と装飾音
- 装飾音は本命判定には使用しません

## コード入力
- ROOT：12音
- BASE：Major / Minor
- SHAPE：sus4 / Dim / Aug
- DECORATION：6 / 7 / maj7 / dim7 / add9 / 9 / 11 / 13
- MajorとMinorはどちらか一方
- DimとAugは同時選択不可
- m表記がないコードはMajorを選択
- Cdimは Major + Dim
- Caugは Major + Aug
- Csus4は Major + sus4

GitHub Pagesへ全ファイルをアップロードすると、そのまま利用できます。
