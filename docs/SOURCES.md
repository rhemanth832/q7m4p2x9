# Sources and asset credits

Research and data retrieval completed on 23 October 2026. The application remains explicitly a January 2026 historical replay.

## Primary domain sources

1. **Elexon FUELHH stream documentation**  
   https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream  
   Requested actual series. The ingestion filters `fuelType=WIND` and retains `startTime`, `publishTime` and `generation`.
2. **Elexon WINDFOR stream documentation**  
   https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream  
   Requested forecast series. The ingestion queries publication windows and retains every returned forecast revision.
3. **Elexon API developer portal**  
   https://developer.data.elexon.co.uk/  
   API endpoint organization and streaming response guidance.
4. **Elexon NETA Interface Definition and Design, Part 1**  
   https://bscdocs.elexon.co.uk/bsc-module/interface-definition-documents/neta-interface-definition-and-design-document-part-1-interfaces-with-bsc-parties-and-their-agents/v-57-0/id-67b34bd747c7f13fbb2970f5  
   FUELHH/WINDFOR field meanings, publication provenance and generation in MW. Runtime behavior is grounded in the actually retrieved API records.
5. **Nord Pool: About the N2EX Day Ahead Auction**  
   https://support.nordpoolgroup.com/support/solutions/articles/8000088463-about-the-n2ex-day-ahead-auction  
   N2EX gate closure at 09:50 GMT and next-day physical delivery.
6. **EPEX SPOT trading brochure**  
   https://www.epexspot.com/sites/default/files/2022-07/22-07-12_TradingBrochure.pdf  
   GB hourly day-ahead auction timing at 09:20 GMT following market decoupling. The UI's EPEX preset is an explicit assumption, not a universal UK cutoff.

## Implementation references

- Vercel FastAPI deployment: https://vercel.com/docs/frameworks/backend/fastapi
- FastAPI static files: https://fastapi.tiangolo.com/tutorial/static-files/
- FastAPI testing: https://fastapi.tiangolo.com/tutorial/testing/
- React: https://react.dev/
- Vite: https://vite.dev/
- Docker multistage builds: https://docs.docker.com/build/building/multi-stage/

## Assets

- Photograph: **雙 film**, “Wind turbines at sea during a beautiful sunset,” Unsplash, published 16 December 2025. https://unsplash.com/photos/NPC-qhyoX78  
  License: https://unsplash.com/license  
  The photo is illustrative; it is not claimed to document a particular GB site. Pinterest is not used as a stock-photo source because reposts do not reliably establish reuse rights.
- Icons: **Lucide**, ISC. https://lucide.dev/license
- Typeface: **Inter**, SIL Open Font License 1.1. https://github.com/rsms/inter/blob/master/LICENSE.txt
- Design reference and token files: user supplied, preserved in `design/`.
- Demo narration: **Piper TTS** with generic `en_GB-vctk-medium` voice, not the candidate's voice. Engine: https://github.com/OHF-Voice/piper1-gpl  
  Voice model and model card: https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_GB/vctk/medium  
  The VCTK source dataset is CC BY 4.0; credit: Centre for Speech Technology Research, University of Edinburgh, VCTK corpus. Voice-model use is limited to the demonstration audio; model weights are not part of the application source package. Consult the model card for its source and license.

All measured generation and error figures are derived from the Elexon archive. No external source supplies demand, market prices or additional generation data to the application.
