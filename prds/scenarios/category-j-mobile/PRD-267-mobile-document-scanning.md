# PRD-267: Mobile Document Scanning

## Metadata
- **PRD ID**: PRD-267
- **Title**: Mobile Document Scanning
- **Category**: J - Mobile & Accessibility
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-261 (Mobile UI), Contract parsing (PRD-003), OCR capability

---

## Problem Statement

CSMs receive physical documents from customers - signed contracts, whiteboard diagrams from meetings, business cards, and handwritten notes. Currently, they must find a separate scanner app, scan the document, then manually upload to CSCX.AI. This friction means many documents never make it into the system.

## User Story

> As a CSM, I want to scan physical documents directly within CSCX.AI using my phone camera so that I can quickly capture and attach contracts, meeting notes, and business cards to customer records.

---

## Functional Requirements

### FR-1: Camera Scanning
- **FR-1.1**: Launch camera from document upload
- **FR-1.2**: Auto-detect document edges
- **FR-1.3**: Perspective correction
- **FR-1.4**: Multi-page scanning
- **FR-1.5**: Flash control for low light

### FR-2: Image Processing
- **FR-2.1**: Auto-crop and straighten
- **FR-2.2**: Enhance contrast/clarity
- **FR-2.3**: Remove shadows
- **FR-2.4**: Convert to PDF
- **FR-2.5**: Compress for efficient storage

### FR-3: OCR & Text Extraction
- **FR-3.1**: Extract text from scanned document
- **FR-3.2**: Recognize handwritten text (where possible)
- **FR-3.3**: Detect document type (contract, notes, business card)
- **FR-3.4**: Extract structured data from business cards
- **FR-3.5**: Make scanned documents searchable

### FR-4: Customer Attachment
- **FR-4.1**: Associate with customer record
- **FR-4.2**: Auto-suggest customer from extracted text
- **FR-4.3**: Add document metadata/description
- **FR-4.4**: Tag document type
- **FR-4.5**: Route to appropriate folder

### FR-5: Integration
- **FR-5.1**: Trigger contract parsing for contracts
- **FR-5.2**: Create contact from business card
- **FR-5.3**: Extract action items from meeting notes
- **FR-5.4**: Store in customer's Drive folder
- **FR-5.5**: Add to document search index

---

## Non-Functional Requirements

### NFR-1: Quality
- Scan quality sufficient for legal documents

### NFR-2: Speed
- Scan processing < 3 seconds per page

### NFR-3: Privacy
- Document processing can be done on-device

---

## Technical Approach

### Camera Scanner Component

```typescript
// Document scanner using device camera
import { Camera } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';

const DocumentScanner: React.FC<{
  onScan: (pages: ScannedPage[]) => void;
}> = ({ onScan }) => {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<Camera>(null);

  const captureDocument = async () => {
    if (!cameraRef.current) return;

    setIsProcessing(true);
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.9,
      base64: false,
    });

    // Detect document edges
    const edges = await detectDocumentEdges(photo.uri);

    // Apply perspective correction
    const corrected = await applyPerspectiveCorrection(photo.uri, edges);

    // Enhance image
    const enhanced = await ImageManipulator.manipulateAsync(
      corrected,
      [
        { contrast: 1.2 },
        { brightness: 1.05 },
      ],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    setPages([...pages, {
      uri: enhanced.uri,
      width: enhanced.width,
      height: enhanced.height,
    }]);
    setIsProcessing(false);
  };

  const finishScanning = async () => {
    // Convert to PDF
    const pdfUri = await convertToPDF(pages);

    // Run OCR
    const ocrResult = await runOCR(pages);

    onScan({
      pdfUri,
      pages,
      extractedText: ocrResult.text,
      detectedType: ocrResult.documentType,
      structuredData: ocrResult.structuredData,
    });
  };

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={Camera.Constants.Type.back}
      >
        <DocumentEdgeOverlay />
      </Camera>

      <View style={styles.controls}>
        <Text>{pages.length} pages scanned</Text>

        <TouchableOpacity
          onPress={captureDocument}
          disabled={isProcessing}
          style={styles.captureButton}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" />
          ) : (
            <CameraIcon />
          )}
        </TouchableOpacity>

        {pages.length > 0 && (
          <Button title="Done" onPress={finishScanning} />
        )}
      </View>

      <PageThumbnails pages={pages} onRemove={removePage} />
    </View>
  );
};
```

### Edge Detection (using OpenCV or ML)

```typescript
// Document edge detection
import { VisionCamera } from 'react-native-vision-camera';
import { useFrameProcessor } from 'react-native-vision-camera';

const detectDocumentEdges = async (imageUri: string): Promise<DocumentEdges> => {
  // Using TensorFlow Lite model for edge detection
  const model = await loadModel('document_detector.tflite');

  const image = await loadImage(imageUri);
  const tensor = imageToTensor(image);

  const prediction = await model.predict(tensor);

  // Extract corner points from prediction
  const edges = {
    topLeft: { x: prediction[0], y: prediction[1] },
    topRight: { x: prediction[2], y: prediction[3] },
    bottomRight: { x: prediction[4], y: prediction[5] },
    bottomLeft: { x: prediction[6], y: prediction[7] },
  };

  return edges;
};

// Perspective correction
const applyPerspectiveCorrection = async (
  imageUri: string,
  edges: DocumentEdges
): Promise<string> => {
  // Calculate transform matrix
  const srcPoints = [
    edges.topLeft,
    edges.topRight,
    edges.bottomRight,
    edges.bottomLeft,
  ];

  const dstPoints = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  const transformMatrix = calculatePerspectiveTransform(srcPoints, dstPoints);

  // Apply transform
  return await applyTransform(imageUri, transformMatrix);
};
```

### OCR Integration

```typescript
// OCR processing
interface OCRResult {
  text: string;
  blocks: TextBlock[];
  documentType: 'contract' | 'notes' | 'business_card' | 'other';
  structuredData?: BusinessCard | ContractData | MeetingNotes;
  confidence: number;
}

const runOCR = async (pages: ScannedPage[]): Promise<OCRResult> => {
  // Use Google ML Kit or Tesseract
  const allText: string[] = [];
  const allBlocks: TextBlock[] = [];

  for (const page of pages) {
    const result = await TextRecognizer.recognize(page.uri);
    allText.push(result.text);
    allBlocks.push(...result.blocks);
  }

  const combinedText = allText.join('\n\n');

  // Classify document type
  const documentType = await classifyDocument(combinedText);

  // Extract structured data based on type
  let structuredData;
  switch (documentType) {
    case 'business_card':
      structuredData = await extractBusinessCardData(combinedText, allBlocks);
      break;
    case 'contract':
      structuredData = await extractContractData(combinedText);
      break;
    case 'notes':
      structuredData = await extractMeetingNotes(combinedText);
      break;
  }

  return {
    text: combinedText,
    blocks: allBlocks,
    documentType,
    structuredData,
    confidence: calculateConfidence(allBlocks),
  };
};

// Business card extraction
const extractBusinessCardData = async (
  text: string,
  blocks: TextBlock[]
): Promise<BusinessCard> => {
  // Use AI to extract structured data
  const extraction = await claude.complete({
    prompt: `Extract contact information from this business card text:

${text}

Return JSON with: name, title, company, email, phone, address, linkedin_url, website`
  });

  return JSON.parse(extraction);
};
```

### API Integration

```typescript
// Upload scanned document
const uploadScannedDocument = async (
  scan: ScanResult,
  customerId: string,
  options: UploadOptions
): Promise<Document> => {
  // Upload PDF to storage
  const fileUrl = await uploadFile(scan.pdfUri, {
    folder: `customers/${customerId}/documents`,
    filename: `scan_${Date.now()}.pdf`,
  });

  // Create document record
  const document = await api.createDocument({
    customer_id: customerId,
    file_url: fileUrl,
    file_name: options.name || 'Scanned Document',
    document_type: scan.detectedType,
    extracted_text: scan.extractedText,
    metadata: {
      scanned: true,
      page_count: scan.pages.length,
      ocr_confidence: scan.confidence,
    },
  });

  // Handle based on document type
  if (scan.detectedType === 'contract' && options.parseContract) {
    await triggerContractParsing(document.id);
  }

  if (scan.detectedType === 'business_card' && scan.structuredData) {
    const contact = await createContactFromBusinessCard(
      customerId,
      scan.structuredData
    );
    document.linked_contact_id = contact.id;
  }

  // Add to search index
  await indexDocument(document.id, scan.extractedText);

  return document;
};
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Scan usage rate | 20% of mobile users | Feature tracking |
| Documents scanned | 5+ per active user/month | Upload tracking |
| OCR accuracy | 95%+ for printed text | Quality audit |
| Processing time | < 3 seconds per page | Performance logs |

---

## Acceptance Criteria

- [ ] Camera launches from document upload
- [ ] Document edges detected automatically
- [ ] Perspective correction applied
- [ ] Multi-page scanning supported
- [ ] PDF generated from scans
- [ ] OCR extracts readable text
- [ ] Document type detected
- [ ] Business card creates contact
- [ ] Contract triggers parsing
- [ ] Scanned documents searchable

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Camera scanner UI | 3 days |
| Edge detection | 3 days |
| Image processing | 2 days |
| OCR integration | 3 days |
| PDF generation | 1 day |
| Business card extraction | 2 days |
| API integration | 2 days |
| Testing | 2 days |
| **Total** | **18 days** |

---

## Notes

- Consider on-device ML for privacy
- Add batch scanning mode for multiple documents
- Future: Whiteboard scanning with shape recognition
- Future: Handwriting recognition improvement
- Future: Document comparison (diff)
