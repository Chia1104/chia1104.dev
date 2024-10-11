package main

import (
	"context"
	"fmt"
	"image"
	"io"
	"log"
	"time"

	"cloud.google.com/go/storage"
	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
	"github.com/cloudevents/sdk-go/v2/event"
	"gocv.io/x/gocv"
)

func main() {
	functions.CloudEvent("ImageResize", imageResize)
}

type StorageObjectData struct {
	Bucket         string    `json:"bucket,omitempty"`
	Name           string    `json:"name,omitempty"`
	Metageneration int64     `json:"metageneration,string,omitempty"`
	TimeCreated    time.Time `json:"timeCreated,omitempty"`
	Updated        time.Time `json:"updated,omitempty"`
}

const (
	bucketName = "public-assets.chia1104.dev"
)

func loadGoogleCredentials() *storage.Client {
	ctx := context.Background()
	client, err := storage.NewClient(ctx)
	if err != nil {
		log.Fatalf("Create GCS client failed: %v", err)
	}
	return client
}

func downloadImageFromGCS(client *storage.Client, object string) gocv.Mat {
	ctx := context.Background()
	r, err := client.Bucket(bucketName).Object(object).NewReader(ctx)
	if err != nil {
		log.Fatalf("Failed to read image: %v", err)
	}
	defer r.Close()

	body, err := io.ReadAll(r)
	if err != nil {
		log.Fatalf("Failed to read image: %v", err)
	}

	img, err := gocv.IMDecode(body, gocv.IMReadColor)
	if err != nil {
		log.Fatalf("Failed to decode image: %v", err)
	}

	return img
}

func uploadImageToGCS(client *storage.Client, img gocv.Mat, object string) {
	ctx := context.Background()
	buf, err := gocv.IMEncode(".jpg", img)
	if err != nil {
		log.Fatalf("Failed to encode image: %v", err)
	}

	wc := client.Bucket(bucketName).Object(object).NewWriter(ctx)
	defer wc.Close()

	if _, err := wc.Write(buf.GetBytes()); err != nil {
		log.Fatalf("Failed to write image: %v", err)
	}
}

func imageResize(ctx context.Context, e event.Event) error {
	log.Printf("Event ID: %s", e.ID())
	log.Printf("Event Type: %s", e.Type())

	var data StorageObjectData
	if err := e.DataAs(&data); err != nil {
		return fmt.Errorf("event.DataAs: %v", err)
	}

	log.Printf("Bucket: %s", data.Bucket)
	log.Printf("File: %s", data.Name)
	log.Printf("Metageneration: %d", data.Metageneration)
	log.Printf("Created: %s", data.TimeCreated)
	log.Printf("Updated: %s", data.Updated)

	client := loadGoogleCredentials()
	img := downloadImageFromGCS(client, data.Name)
	defer img.Close()
	newWidth := 100
	newHeight := 100
	resizedImg := gocv.NewMat()
	defer resizedImg.Close()

	gocv.Resize(img, &resizedImg, image.Point{X: newWidth, Y: newHeight}, 0, 0, gocv.InterpolationLinear)
	uploadImageToGCS(client, resizedImg, fmt.Sprintf("resized_%s", data.Name))
	log.Println("Image resized successfully")

	return nil
}
