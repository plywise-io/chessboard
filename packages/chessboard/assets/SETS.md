# Vendored piece sets

The curated sets in `pieceSets` are vendored into this package so rendering
never touches a CDN. Each directory holds the pristine upstream files; the
generated module `src/internal/pieceSets.gen.ts` embeds them (regenerate with
`node scripts/gen-piece-sets.mjs` from the repository root). Vendored on
**2026-08-23**.

| Set | Upstream | Author | License |
| --- | --- | --- | --- |
| `rhosgfx` | <https://github.com/lichess-org/lila/tree/master/public/piece/rhosgfx> | Roland Hosgfx | CC0 1.0 |
| `kiwenSuwi` (`kiwen-suwi`) | <https://github.com/lichess-org/lila/tree/master/public/piece/kiwen-suwi> | neverRare — <https://lichess.org/@/neverRare> | CC BY 4.0 (attribution required) |
| `chessnut` | <https://github.com/LexLuengas/chessnut-pieces/tree/2b8eaf14a31edad7e9deb53b1473e1d4857868a9> (pinned commit) | Lex Luengas | Apache-2.0 |
| `spatial` | <https://github.com/lichess-org/lila/tree/master/public/piece/spatial> | Maurizio Monge | MIT |
| `celtic` | <https://github.com/lichess-org/lila/tree/master/public/piece/celtic> | Maurizio Monge | MIT |

Licenses verified against lila's COPYING.md and each upstream LICENSE file.
The default set (Cburnett artwork) has its own notice in
[`cburnett/LICENSE.md`](./cburnett/LICENSE.md).

NOTICE (required when distributing this package or its artifacts):

- `kiwenSuwi` © neverRare — <https://lichess.org/@/neverRare> (CC BY 4.0)
- `chessnut` © Lex Luengas (Apache-2.0)
- `spatial`, `celtic` © Maurizio Monge (MIT)

## Provenance (SHA-1 at vendoring time)

### rhosgfx

```
78f2649572d97b1b405b16ebb415024e812ce075  bB.svg
4b107d4a84e2e25f8b11feeb6a11e454399b91cf  bK.svg
8068737641a48093a6a0eec88d91f538fba0cdd4  bN.svg
7da34d8a0b9055e929a412184c4a88930ce7a933  bP.svg
041033d8cf407ff1c6c11f1a816a98156fe71f28  bQ.svg
4c88db771a9c80b8f255106bada24de8d46c4eac  bR.svg
97568637edc94a2bb74899e019d66e2610812df2  wB.svg
a0b0155715db407db3ae3ba71876032107dbdb29  wK.svg
ecc9fa6711466606f85518abb2de08f813a7b1bf  wN.svg
90e34db2676bbba28f58e2ae5ff0fcb9ee363033  wP.svg
22abcb71e8394a5c8cb154490189d9bec4008f60  wQ.svg
b3d6f56486c4cf4f0b163bc15878802f1b37996a  wR.svg
```

### kiwen-suwi

```
587956bb55b9ae5e5849c934c133c3c9eec559fa  bB.svg
97b6632c3758c027a631d38fe33ddc0c56794f3d  bK.svg
6f0d865ca07f4fc6da4b3e48160bafb7f4f3b344  bN.svg
329483d1213f17d88af0973dcb4c77d7c9f96a9b  bP.svg
b92fe908aab7e51c9d30824f3f15c79da22d2acf  bQ.svg
c0c010fd4765f0f9eadae2dafbedf50dba825a3b  bR.svg
e049bf9a5b0158204417fab6af808c253917ec2b  wB.svg
8280bec60d66d89337d2105f16cd2e43151b65c1  wK.svg
7f2150bd7320a4726dbd0ef69260fd9970ab9f41  wN.svg
36a02dd786bf04b24cef1aa2b9162279cda8627b  wP.svg
10a29c6ecb4c496121d666767bd0e2d1ce548ca3  wQ.svg
4b1ac3270998e19391ca57ae2779d2870d7073fc  wR.svg
```

### chessnut

```
7b71b6bcbe4bb74d3c551583d429f9cd872399bf  bB.svg
ea8e1141070af07f128be31f002e091807b3c01c  bK.svg
17701c70dc02ccfe808cbb671568cf86e3134c4a  bN.svg
98502140722c79ee80063b4f68bc90964607249c  bP.svg
6a636afb763fa5f709a5781d1584f3bc3d3086ae  bQ.svg
9ecf6c4f6b99b326564b0bb91aca42f343eca7e3  bR.svg
7d5d7e11e9507f238f1013ad287ece17e82037d9  wB.svg
913618005d1ed927848ac30ead413d62574ff5cd  wK.svg
19bd529bcac95f8bcc0f492ad161684192c39cdd  wN.svg
ce294653d1b60feab7881ea05ee3124aa2a4503d  wP.svg
00cc69bfa1ac65233089b396f49bd82b78cefe47  wQ.svg
7e1adc27ff1e66a51ae2d8bf3871756332faff64  wR.svg
```

### spatial

```
c45c54bb85f3b0a71159129abbf5d6a751e7ce76  bB.svg
d220c9363d54df370bdbc443b764c49f7a4fce52  bK.svg
8ac67a5162b47b6d03e99f77f9b104c27faa1fdf  bN.svg
b418258f5805f061ee924066b664ce33c46a8e86  bP.svg
52460139b9e65e2771e1dd95c0896acdf828ce84  bQ.svg
750b40ab8bd05e354550721b905aa41aa80a1597  bR.svg
bf4e9e917190699e279ede7dfbe968254834f837  wB.svg
9330e5a5662cd478c6abfa288aae8716727ee828  wK.svg
2d6e727cd6f7d424dcee2d2b37cb09c430d9e6be  wN.svg
38a74369550b831dd7d6fff9b8e46bcf92165d5f  wP.svg
5af6cc620d29448e05b25f5f28fa0da522a14f78  wQ.svg
7e11c20eaf4be9880c17efda2db0c46619c0fa7f  wR.svg
```

### celtic

```
625879273b0706cc467476604daf30ae740f27fb  bB.svg
e4b93e8bc6bba9858a50d479fd9f1e76d71c86c4  bK.svg
52345afa7bc5422414f3951449cd2d323c181408  bN.svg
a1a1586084348c2d0375c5163d377e1d02b2906c  bP.svg
82b29eca0cb2863e90d4494b7f010c0aa17d7210  bQ.svg
72610759a7dfcd49630ad5d83c157fdd30d79966  bR.svg
538db9f39be357ceaefd69489dde1224320a94bf  wB.svg
380e8965afeaaa6141eaa367f1d748976d34fab1  wK.svg
6fb45e44b993c25a93be203ca07c3aa1be9aa894  wN.svg
8dc37a2432244568a35e8b3a2177bf9c28cf9f1f  wP.svg
ae6ac900762114c2653f60f2f55dd60708cc5fb0  wQ.svg
a9be56b7432a27f81b6e060c6d4a1d326d71a979  wR.svg
```
