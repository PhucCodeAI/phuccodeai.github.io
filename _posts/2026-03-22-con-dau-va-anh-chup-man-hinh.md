---
title: "Chỉ một class YOLO có độ chính xác thấp: chuyện xác thực ảnh giấy đăng ký kinh doanh"
description: "Mọi class đều lên điểm, trừ một vạch xám mảnh giữa hai trang. Ba giả thuyết, hai lần sai. Thủ phạm là một augmentation mà Ultralytics bật sẵn khi train. Kèm theo: chấm điểm con dấu cùng lý do 99% accuracy có thể chẳng nói lên điều gì."
tags: [Computer Vision, YOLO, Data Labeling, Imbalanced Data]
date: 2026-03-22 22:30:00 +0700
toc: true
---

<div class="stats">
  <div class="stat"><span class="stat-label">Kiểm tra trên mỗi ảnh</span><span class="stat-value">4</span><span class="stat-note">chất lượng dấu, dấu giả, chụp màn hình, chụp lại</span></div>
  <div class="stat"><span class="stat-label">Giả thuyết đã thử</span><span class="stat-value">3</span><span class="stat-note">trước khi tìm ra thủ phạm</span></div>
  <div class="stat"><span class="stat-label">Thời gian gán nhãn lại</span><span class="stat-value">−50%</span><span class="stat-note">nhờ để model gợi ý nhãn</span></div>
  <div class="stat"><span class="stat-label">Con dấu giả</span><span class="stat-value">~1%</span><span class="stat-note">của dữ liệu thật</span></div>
</div>

Mọi class đều lên điểm, trừ đúng một: vạch xám mảnh, chỉ vài pixel, nằm giữa hai trang tài liệu. Đổi sang line detection, corner detection, rồi gán nhãn lại cả bộ dữ liệu, class đó vẫn không chịu học. Deadline đến gần, ý tưởng thì cạn.

Thủ phạm hóa ra không nằm ở model, cũng không hẳn ở dữ liệu, mà ở một tính năng được bật sẵn mà gần như ai train YOLO cũng để nguyên.

## 1. Một tấm ảnh, bốn câu hỏi

Doanh nghiệp và hộ kinh doanh mở tài khoản trên app ngân hàng phải chụp Giấy chứng nhận đăng ký doanh nghiệp hoặc đăng ký hộ kinh doanh (gọi chung là giấy đăng ký kinh doanh) và tải lên. Trước khi tin tấm ảnh đó, hệ thống phải trả lời bốn câu hỏi:

| Câu hỏi | Nếu trả lời sai |
|---|---|
| Con dấu có đủ rõ để xử lý không? | Hồ sơ không dùng được, phải yêu cầu chụp lại |
| Con dấu có phải dấu giả không? | Mở tài khoản cho một doanh nghiệp không có thật |
| Đây có phải ảnh chụp màn hình không? | Nhận một tệp có thể đã bị chỉnh sửa thay vì giấy tờ gốc |
| Đây có phải ảnh chụp lại từ một màn hình khác không? | Như trên, nhưng khó phát hiện hơn nhiều |

Câu chuyện vạch xám thuộc về câu hỏi thứ ba.

## 2. Vạch xám không chịu học

### Vì sao phải phát hiện một vạch xám

Khi mở một tài liệu trên máy tính hoặc điện thoại, giữa hai trang liền nhau có một dải xám ngăn cách. Giấy thật thì không bao giờ có. Nên nếu ảnh có vạch đó, gần như chắc chắn khách đang nộp ảnh chụp màn hình chứ không phải chụp tờ giấy. Cùng với biểu tượng pin, đồng hồ, các nút điều khiển, nó là một trong các class mà model YOLOv10 phải phát hiện.

Các class khác học rất nhanh. Class vạch ngăn thì không.

### Giả thuyết 1: model không sinh ra cho kiểu vật thể này

Vạch ngăn mảnh và dài, khác hẳn những vật thể "tròn trịa" mà YOLO quen phát hiện. Tìm trên các forum hay hỏi LLM đều nhận về cùng một câu trả lời: *model không được thiết kế để nhận diện những đối tượng như vậy*. Nghe rất hợp lý, nên bài toán được chuyển sang các hướng chuyên cho đường thẳng và góc: line detection, corner detection.

Không cải thiện. Và đó là gợi ý đầu tiên rằng đang sửa sai chỗ.

### Giả thuyết 2: dữ liệu sai

Bộ dữ liệu train có hai nguồn. Nguồn thứ nhất là dữ liệu tổng hợp tự sinh, nhãn được tạo cùng lúc với ảnh nên đúng tới từng hộp. Nguồn thứ hai là bộ ảnh gốc được giao kèm nhãn sẵn. Bộ này đã có người gán và đã train ra những model khác, nên được mặc định là đúng và không ai động tới.

Cho đến khi mở lại từng ảnh của chính bộ gốc đó: **các vạch ngăn bị bỏ sót gần như toàn bộ**. Thứ được tin tưởng nhất hóa ra lại là thứ sai. Model không học kém. Nó đang nhận hai thông điệp trái ngược: dữ liệu tự sinh bảo vạch ngăn là một class, còn bộ gốc khẳng định đó chỉ là nền.

Gán lại nhãn bằng tay toàn bộ thì quá lâu, nên việc gán nhãn được chia thành từng đợt, để model cải thiện từng vòng rồi vẽ box sau đó người soát lại:

<figure class="flow-loop" markdown="0">
  <p class="flow-title">Gán nhãn theo vòng: model cải thiện từng vòng rồi vẽ box sau đó người soát lại</p>
  <div class="flow-grid">
    <div class="flow-step"><span class="flow-num">1</span><span class="flow-role is-human">Người</span><strong>Gán tay một đợt nhỏ</strong><span class="flow-text">Chỉ đợt đầu tiên làm hoàn toàn bằng tay</span></div>
    <div class="flow-step"><span class="flow-num">2</span><span class="flow-role is-model">Model</span><strong>Train</strong><span class="flow-text">Một lượt ngắn trên toàn bộ dữ liệu đã có nhãn đúng</span></div>
    <div class="flow-step"><span class="flow-num">3</span><span class="flow-role is-model">Model</span><strong>Gợi ý nhãn</strong><span class="flow-text">Cho đợt dữ liệu kế tiếp</span></div>
    <div class="flow-step"><span class="flow-num">4</span><span class="flow-role is-human">Người</span><strong>Review và sửa</strong><span class="flow-text">Chỉ sửa những chỗ model gợi ý sai</span></div>
    <div class="flow-back">↺ Quay lại bước 2 với dữ liệu vừa soát, lặp cho đến khi hết dữ liệu</div>
  </div>
</figure>

Mỗi vòng model giỏi lên một chút, phần người phải sửa ít đi một chút. Tổng thời gian gán nhãn giảm khoảng một nửa.

Nhưng nhãn đã đúng mà class vạch ngăn chỉ tăng **chưa tới 10 điểm**. Kiểu lỗi mới đáng chú ý hơn con số: model **bỏ sót rất nhiều nhưng hiếm khi báo nhầm**. Như thể nó vẫn đang được dạy rằng vạch ngăn là nền, từ một nguồn nào đó nằm ngoài bộ nhãn.

Hết giả thuyết, deadline lại sát. Class này đành tạm gác lại để chuyển sang việc khác.

### Giả thuyết 3: chính quá trình train đang dạy sai

Lời giải đến một cách tình cờ. Trong lúc mở lại các ảnh training batch mà Ultralytics lưu ra để đánh giá model, các vạch xám hiện ra ngay trong từng ảnh mosaic.

YOLO mặc định bật **mosaic augmentation**: ghép bốn ảnh thành một để model thấy nhiều ngữ cảnh hơn. Với phần lớn bài toán, đây là một trong những augmentation hiệu quả nhất. Nhưng hãy nhìn chỗ bốn ảnh tiếp giáp nhau: **một đường thẳng chạy ngang qua khung hình, ranh giới giữa hai vùng nội dung**. Nó trông giống hệt vạch ngăn giữa hai trang.

Và đường ghép đó không có nhãn. Mỗi batch, mosaic lại tạo ra hàng loạt "vạch ngăn giả" và dạy model rằng chúng là nền, triệt tiêu đúng những gì vừa được gán nhãn lại. Điều này cũng giải thích vì sao model bỏ sót nhiều mà ít báo nhầm: nó bị ép phải coi mọi vạch thẳng là nền.

Tắt mosaic cho model này trong toàn bộ quá trình train, class vạch ngăn lên điểm như mọi class khác.

### Bài học rút ra sau lần này

Thứ tự nghi ngờ bây giờ ngược lại so với lúc đầu: **dữ liệu trước, quá trình train sau, model cuối cùng**. Một class kém bất thường trong khi các class khác tốt gần như không bao giờ là lỗi kiến trúc. Và khi gặp kiểu lỗi lệch hẳn về một phía (bỏ sót nhiều, báo nhầm ít), hãy tìm xem model đang được dạy điều ngược lại ở đâu.

## 3. Con dấu: chấm điểm thay vì đạt / không đạt

Con dấu mờ, nhòe hay thiếu nét thì giấy tờ không dùng được. Cách tự nhiên là phân loại đạt / không đạt, nhưng ngưỡng "đạt" lại khác nhau tùy nghiệp vụ. Nên model trả về **một điểm liên tục từ 0 đến 1**, còn ngưỡng để nghiệp vụ tự chọn mà không cần train lại.

Câu hỏi khó hơn là lấy nhãn ở đâu, vì "chất lượng con dấu" rất cảm tính. Cách làm là ngồi cùng các thẩm định viên, những người dùng trực tiếp, để thống nhất N tiêu chí cụ thể. Sau đó LLM xét từng tiêu chí trên ảnh con dấu, mỗi tiêu chí đạt được cộng 1/N điểm. Nhãn vì vậy không còn là cảm giác của người gán, mà là "con dấu này đạt bao nhiêu tiêu chí".

Điểm cuối cùng là trung bình có trọng số của ba model họ EfficientNet, model có độ chính xác cao hơn có tiếng nói lớn hơn, để những con dấu nằm sát ngưỡng không bị lật qua lật lại.

## 4. Con dấu giả: khi 99% accuracy chẳng nói lên điều gì

Con dấu giả chỉ chiếm khoảng 1% dữ liệu thật. Ở tỉ lệ đó, một model chẳng học gì, cứ đoán "thật" cho mọi ảnh, vẫn đạt **99% accuracy** mà không bắt được một con dấu giả nào.

Vì vậy bài toán này không nhìn accuracy, mà nhìn precision và recall của riêng lớp con dấu giả. Giữa hai chỉ số đó, **precision** được ưu tiên: báo nhầm một con dấu thật là giả nghĩa là từ chối một khách hàng thật. Gần như chắc chắn mất luôn khách đó. Mẫu giả thật quá ít nên phải bổ sung bằng dữ liệu tổng hợp và cải thiện dần qua từng vòng.

Chi tiết model nhận ra con dấu giả bằng đặc trưng nào thì xin phép không chia sẻ. Đó là phần chống gian lận. Nó chỉ có tác dụng khi người muốn qua mặt không biết.

## 5. Ảnh chụp lại: dấu vết nằm ở từng điểm ảnh

### Không có gì để nhìn ở mức nội dung

Ảnh chụp màn hình còn để lại dấu vết rõ ràng: pin, đồng hồ, nút bấm, vạch ngăn trang. Ảnh **chụp lại** thì không. Khách mở giấy tờ trên một màn hình rồi dùng điện thoại chụp lại. Ở mức nội dung, kết quả trông khá giống ảnh chụp một tờ giấy thật. Dấu vết duy nhất nằm ở mức thấp hơn nhiều: **từng điểm ảnh**.

### Vì sao chụp lại màn hình luôn có "sóng"

Ai từng dùng điện thoại chụp màn hình máy tính hay các thiết bị điện tử có màn hình màu đều thấy những vệt gợn sóng loang trên ảnh. Đó là **vân moiré**. Nó gần như không tránh được, vì hai lưới đang chồng lên nhau:

| Lưới | Ở đâu |
|---|---|
| Lưới điểm ảnh của màn hình | Hàng triệu điểm ảnh, mỗi điểm gồm các điểm con đỏ, lục, lam xếp đều nhau |
| Lưới cảm biến của camera | Các điểm cảm biến, mỗi điểm chỉ nhận một màu qua bộ lọc màu |

Khi camera ghi lại một mẫu lặp có tần số cao hơn mức nó lấy mẫu được (vượt giới hạn Nyquist), phần tần số cao đó không biến mất mà **gập xuống thành các vân tần số thấp**, nhìn thấy được bằng mắt. Hiện tượng này gọi là aliasing. Hình dạng vân thay đổi theo góc chụp và khoảng cách giữa máy ảnh với màn hình ([Yu và cộng sự, 2022](https://arxiv.org/pdf/2207.09935); [Yue và cộng sự, NeurIPS 2023](https://arxiv.org/pdf/2310.20332)).

Ngoài moiré còn một dấu vết thứ hai: **dải sáng tối**. Nhiều màn hình điều chỉnh độ sáng bằng cách bật tắt rất nhanh (PWM), trong khi camera điện thoại đọc cảm biến lần lượt từng hàng (rolling shutter). Mỗi hàng vì vậy bắt được màn hình ở một thời điểm sáng tối khác nhau, tạo thành các dải ngang ([RIFLE, 2025](https://arxiv.org/pdf/2509.24644)).

### Vì sao phải xét trên từng điểm ảnh

Cả hai dấu vết đều là **mẫu lặp rất nhỏ trải khắp bức ảnh**, không phải một vật thể có hình dạng như biểu tượng pin hay vạch ngăn trang. Vì vậy cách tiếp cận của phát hiện ảnh chụp màn hình (tìm vật thể) không dùng được, mà phải phân tích ảnh ở mức điểm ảnh. Một hệ quả thực tế: thu nhỏ ảnh trước khi đưa vào model, một bước tiền xử lý rất phổ biến, có thể xóa luôn chính dấu vết cần tìm.

Đặc trưng cụ thể mà hệ thống dùng thì xin phép không chia sẻ, vì đây là phần chống gian lận.

## 6. Bài học

- **Một class kém bất thường thì nghi dữ liệu trước, quá trình train sau, model cuối cùng.**
- **Augmentation mặc định cũng phải hiểu rõ.** Mosaic có ích cho phần lớn bài toán, nhưng ở đây nó tự tạo ra đúng thứ cần phát hiện.
- **Để model gán nhãn cùng mình.** Gán nhãn theo vòng giảm một nửa thời gian mà vẫn có người soát từng mẫu.
- **Dữ liệu lệch thì chọn chỉ số theo cái giá của từng loại sai.** Ở đây báo nhầm đắt hơn bỏ sót.
- **Hiểu cơ chế vật lý trước khi chọn model.** Ảnh chụp lại để lại dấu vết ở mức điểm ảnh, nên cách tìm vật thể không dùng được.
- **Biến cảm tính thành tiêu chí.** "Con dấu đẹp" khó gán nhãn; "đạt k trên N tiêu chí" thì không.
- **Trả về điểm, đừng trả về kết luận.** Điểm 0–1 cho phép nghiệp vụ tự chọn ngưỡng mà không phải train lại model.
