// Safe development seed: re-running upserts the listed movies and never deletes bookings.
const mongoose = require('mongoose');
const K = require('./config/keys');
const { Movie, Theatre, Screen, Seat, Show } = require('./models');
const { DEFAULT_LAYOUT_CONFIG, generateSeatLayout, getSeatRecords } = require('./services/seatLayout');

const movies = [
  {
    title: 'Ramayana: Part 1', language: 'Hindi', languages: ['Hindi', 'Kannada', 'Malayalam', 'Tamil', 'Telugu'], genre: ['Action', 'Adventure', 'Drama'],
    duration: 'Not specified', rating: '8.2/10', votes: '391K+ votes', releaseDate: '2026-11-08', certification: 'Not specified',
    formats: ['2D', '3D'],
    languageFormats: [
      { language: 'Hindi', formats: ['2D', '3D', 'IMAX 3D', '4DX 3D', 'DOLBY CINEMA 2D', 'ICE 3D', '3D SCREEN X'] },
      { language: 'Kannada', formats: ['2D', '3D', 'IMAX 3D', '4DX 3D', 'DOLBY CINEMA 2D', '3D SCREEN X'] }
    ],
    cast: ['Ranbir Kapoor', 'Sai Pallavi', 'Yash', 'Sunny Deol', 'Ravi Dubey'],
    castImages: [
      { name: 'Ranbir Kapoor', imageUrl: 'https://in.bmscdn.com/iedb/artist/images/website/poster/large/ranbir-kapoor-2817-1691565170.jpg' },
      { name: 'Sai Pallavi', imageUrl: 'https://in.bmscdn.com/iedb/artist/images/website/poster/large/sai-pallavi-1065111-1738142313.jpg' },
      { name: 'Yash', imageUrl: 'https://in.bmscdn.com/iedb/artist/images/website/poster/large/yash-2537-1649749519.jpg' },
      { name: 'Sunny Deol', imageUrl: 'https://in.bmscdn.com/iedb/artist/images/website/poster/large/sunny-deol-2299-12-09-2017-03-59-10.jpg' },
      { name: 'Ravi Dubey', imageUrl: 'https://in.bmscdn.com/iedb/artist/images/website/poster/large/ravi-dubey-16823-26-04-2017-16-20-28.jpg' }
    ],
    synopsis: 'An epic retelling of the Ramayana.',
    color: '#473a30',
    backdropUrl: 'https://assets-in.bmscdn.com/discovery-catalog/events/et00451914-dvmfagyreh-landscape.jpg',
    posterUrl: 'https://assets-in.bmscdn.com/discovery-catalog/events/tr:w-400,h-600,bg-CCCCCC,e-usm-2-2-0.5-0.008:w-400.0,h-660.0,cm-pad_resize,bg-000000,fo-top:l-image,i-discovery-catalog@@icons@@star-icon-202203010609.png,lx-24,ly-615,w-29,l-end:l-text,ie-OS4yLzEwICAzOTFLKyBWb3Rlcw%3D%3D,fs-29,co-FFFFFF,ly-612,lx-70,pa-8_0_0_0,l-end/et00451914-guxtbqpqlr-portrait.jpg'
  },
  {
    title: 'Scene', language: 'Tamil', languages: ['Tamil', 'Telugu'], genre: ['Action', 'Comedy', 'Drama'],
    duration: '2h 29m', rating: '9/10', votes: '164K+ votes', releaseDate: '2026-11-06', certification: 'UA16+',
    formats: ['2D', 'EPIQ', 'HDR BY BARCO', 'DOLBY CINEMA 2D'],
    cast: ['Suriya', 'Naslen', 'Nazriya Nazim', 'Anandaraj', 'Lal', 'Rajpriyan', 'Suresh Mathiyalagan', 'Gajaraj', 'Anuradha Sridhar', 'Tovino Thomas (Special Appearance)', 'Jyothika (Special Appearance)'],
    synopsis: 'This exciting action, comedy, and drama movie releases in Tamil and Telugu this coming November.',
    color: '#25304a',
    posterUrl: 'https://assets-in.bmscdn.com/discovery-catalog/events/tr:w-400,h-600,bg-CCCCCC,e-usm-2-2-0.5-0.008:w-400.0,h-660.0,cm-pad_resize,bg-000000,fo-top:l-image,i-discovery-catalog@@icons@@star-icon-202203010609.png,lx-24,ly-615,w-29,l-end:l-text,ie-OS8xMCAgMTY0SysgVm90ZXM%3D,fs-29,co-FFFFFF,ly-612,lx-70,pa-8_0_0_0,l-end/et00516631-avrwcqgkrv-portrait.jpg'
  },
  {
    title: 'Jailer 2', language: 'Tamil', languages: ['Tamil', 'Telugu', '+1'], genre: ['Action', 'Thriller'],
    duration: '2h 45m', rating: '7.2/10', votes: '401K+ interested', releaseDate: '2026-10-15', certification: 'UA16+',
    formats: ['2D', 'DOLBY CINEMA 2D', '4DX', 'EPIQ', 'IMAX 2D', '+1'],
    cast: ['Rajinikanth', 'S. J. Suryah', 'Mithun Chakraborty', 'Suraj Venjaramoodu', 'Ramya Krishnan', 'Vidya Balan', 'Yogi Babu', 'Mirnaa', 'Rithvik', 'Jatin Sarna', 'Hakim Shahjahan', 'Anna Rajan', 'Meghana Raj', 'Namo Narayana', 'Shiva Rajkumar', 'Hrithik Roshan', 'Jackie Shroff', 'Vijay Sethupathi', 'Vinayakan', 'Vasanth Ravi'],
    synopsis: 'An explosive Tamil and Telugu thriller sequel filled with massive amounts of thrilling, intense action.',
    color: '#3b3027',
    posterUrl: 'https://assets-in.bmscdn.com/discovery-catalog/events/et00518674-gybdbrfctn-portrait.jpg'
  },
  {
    title: 'Brindavihari', language: 'Kannada', languages: ['Kannada'], genre: ['Drama', 'Romantic'],
    duration: '2h 39m', rating: 'Not yet rated', votes: '16.4K+ interested', releaseDate: '2026-11-20', certification: 'UA16+',
    formats: ['2D'], cast: ['Ganesh', 'Devika Bhat', 'Malvika Sharma', 'Rangayana Raghu'],
    synopsis: 'An upcoming Kannada romantic drama featuring a compelling story and visually stunning, highly emotional performances.',
    color: '#465247',
    posterUrl: 'https://assets-in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/brindavihari-et00520736-1791197034.jpg'
  },
  {
    title: 'DNK (Donga Koduku)', language: 'Telugu', languages: ['Telugu'], genre: ['Comedy', 'Crime'],
    duration: '2h 11m', rating: '8.8/10', votes: '6.2K+ votes', releaseDate: '2026-11-13', certification: 'UA16+',
    formats: ['2D', 'EPIQ'],
    cast: ['Mouli', 'Tanuj Prasanth', 'Sushmitha Shetty', 'Ali', 'Raghubabu', 'Bhadram', 'Rajitha', 'Priya', 'Gundu Sudharshan', 'Nandagopal', 'Ramana Bhargava'],
    synopsis: 'A youthful Telugu crime comedy about a carefree youngster whose search for quick money fails.',
    color: '#554127',
    posterUrl: 'https://assets-in.bmscdn.com/discovery-catalog/events/tr:w-400,h-600,bg-CCCCCC,e-usm-2-2-0.5-0.008:w-400.0,h-660.0,cm-pad_resize,bg-000000,fo-top:l-image,i-discovery-catalog@@icons@@star-icon-202203010609.png,lx-24,ly-615,w-29,l-end:l-text,ie-OC44LzEwICA2LjJLKyBWb3Rlcw%3D%3D,fs-29,co-FFFFFF,ly-612,lx-70,pa-8_0_0_0,l-end/et00521157-nhckrkenza-portrait.jpg'
  },
  {
    title: 'Ghost Soldier', language: 'English', languages: ['English'], genre: ['Action', 'Thriller'],
    duration: '1h 32m', rating: '8.2/10', votes: '360+ votes', releaseDate: '2026-11-13', certification: 'UA16+',
    formats: ['2D'],
    cast: ['Jim Caviezel', 'Olivia Thirlby', 'Garret Dillahunt', 'Beau Knapp', 'Shea Whigham', 'Michael Ironside', 'Jaina Lee Ortiz', 'Olivia Chenery', 'Tetiana Dar'],
    synopsis: 'A former elite soldier uses futuristic weaponry to battle corporations over rural American land rights.',
    color: '#343b45',
    posterUrl: 'https://assets-in.bmscdn.com/discovery-catalog/events/tr:w-400,h-600,bg-CCCCCC,e-usm-2-2-0.5-0.008:w-400.0,h-660.0,cm-pad_resize,bg-000000,fo-top:l-image,i-discovery-catalog@@icons@@star-icon-202203010609.png,lx-24,ly-615,w-29,l-end:l-text,ie-OS4xLzEwICA1SysgVm90ZXM%3D,fs-29,co-FFFFFF,ly-612,lx-70,pa-8_0_0_0,l-end/et00518333-dehyqgusdp-portrait.jpg'
  },
  {
    title: 'Itllu Arjuna', language: 'Telugu', languages: ['Telugu'], genre: ['Action', 'Drama', 'Romantic'],
    duration: '2h 23m', rating: '9.1/10', votes: '5K+ votes', releaseDate: '2026-11-13', certification: 'UA16+',
    formats: ['2D', 'DOLBY CINEMA 2D'],
    cast: ['Sai Aniesh', 'Anaswara Rajan', 'Vennela Kishore', 'Mukesh Rishi', 'Kalaiyarasan', 'Harikrishnan', 'Brahmaji'],
    synopsis: 'This Telugu film blends romance and action while presenting a very unconventional, unique central character.',
    color: '#4b2d42',
    posterUrl: 'https://assets-in.bmscdn.com/discovery-catalog/events/et00514068-sebugtxnzj-portrait.jpg'
  },
  {
    title: 'Bouma', language: 'Malayalam', languages: ['Malayalam'], genre: ['Mystery', 'Thriller'],
    duration: '1h 55m', rating: '8.4/10', votes: '8.2K+ votes', releaseDate: '2026-11-12', certification: 'A',
    formats: ['2D', 'EPIQ'],
    cast: ['Sagar Surya', 'Dileesh Pothan', 'Vineeth', 'Revathy Sarma', 'Madhupal', 'Lenaa', 'Merin Philip', 'Aditi Balan', 'Mokksha Sengupta', 'Raghunath Paleri', 'Jaffar Idukki', 'Vijay Babu', 'Manikuttan', 'Kavya S Bhanu', 'Sajin Cherukayil'],
    synopsis: 'A gripping Malayalam mystery thriller about a struggling singer inheriting a heavily haunted heritage estate.',
    color: '#352a48',
    posterUrl: 'https://assets-in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/bouma-et00513613-1794734666.jpg'
  },
  {
    title: 'Rashi', language: 'Kannada', languages: ['Kannada'], genre: ['Drama', 'Romantic'],
    duration: '2h 22m', rating: '9.9/10', votes: '150+ votes', releaseDate: '2026-11-13', certification: 'UA16+',
    formats: ['2D'], cast: ['Aditya Shashikumar', 'Ramesh Indira', 'Veena Sundar', 'Manju Pavagada', 'Huli Kartik', 'Ugram Ravi', 'Kari Subbu'],
    synopsis: 'An emotional Kannada romantic drama expected to captivate audiences with its deeply compelling, engaging storyline.',
    color: '#5b3e50',
    posterUrl: 'https://assets-in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/rashi-et00525385-1793945575.jpg'
  },
  {
    title: 'Avengers: Doomsday', language: 'English', languages: ['English', 'Telugu', '+2'], genre: ['Action', 'Adventure', 'Fantasy', 'Sci-Fi'],
    duration: 'Not specified', rating: 'Not yet rated', votes: '631K+ interested', releaseDate: '2026-12-17', certification: 'Not specified',
    formats: ['2D', '3D', 'MS - INFINITY VISION', 'MS-INFINITY VSN 3D'],
    cast: ['Robert Downey Jr.', 'Chris Evans', 'Chris Hemsworth', 'Pedro Pascal', 'Paul Rudd', 'Anthony Mackie', 'Florence Pugh', 'Vanessa Kirby', 'Ebon Moss-Bachrach', 'Wyatt Russell'],
    synopsis: 'The iconic superhero teams finally unite for a massive, thrilling cinematic crossover against new threats.',
    color: '#4d2633',
    posterUrl: 'https://assets-in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/avengers-doomsday-et00439706-1743060959.jpg'
  },
  {
    title: 'Jumanji: Open World', language: 'English', languages: ['English', 'Telugu', '+2'], genre: ['Action', 'Adventure', 'Comedy', 'Fantasy'],
    duration: 'Not specified', rating: 'Not yet rated', votes: '27.8K+ interested', releaseDate: '2026-12-25', certification: 'Not specified',
    formats: ['2D'],
    cast: ['Dwayne Johnson', 'Jack Black', 'Kevin Hart', 'Karen Gillan', 'Nick Jonas', 'Awkwafina', 'Alex Wolff', 'Morgan Turner', "Ser'Darius Blain", 'Madison Iseman', 'Danny DeVito', 'Rhys Darby', 'Marin Hinkle', "Brittany O'Grady", 'Dan Hildebrand', 'Jack Jewkes', 'Bebe Neuwirth', 'Lamorne Morris', 'Burn Gorman', 'Nasim Pedrad'],
    synopsis: 'This exciting fantasy comedy adventure returns with wild new challenges and hilarious, unpredictable character moments.',
    color: '#1e554e',
    posterUrl: 'https://assets-in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/jumanji-open-world-et00493813-1793010653.jpg'
  },
  {
    title: 'O.M Operation Mole', language: 'Tamil', languages: ['Tamil', 'Telugu', '+1'], genre: ['Action', 'Thriller'],
    duration: 'Not specified', rating: 'Not yet rated', votes: '169K+ interested', releaseDate: '2026-11-20', certification: 'Not specified',
    formats: ['2D', 'EPIQ'],
    cast: ['Dhanush', 'Mammootty', 'Sai Pallavi', 'Sreeleela', 'Naseeruddin Shah', 'Indrans', 'Renu Desai'],
    synopsis: 'A highly anticipated, explosive thriller movie releasing in Tamil and Telugu with intense, gripping scenes.',
    color: '#263e47',
    posterUrl: 'https://assets-in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/om-operation-mole-et00504901-1794808665.jpg'
  },
  {
    title: 'Godzilla Minus Zero', language: 'Japanese', languages: ['Japanese', 'English'], genre: ['Action', 'Adventure', 'Horror', 'Thriller'],
    duration: '2h 17m', rating: 'Not yet rated', votes: '56.8K+ interested', releaseDate: '2026-11-20', certification: 'UA16+',
    formats: ['2D', 'IMAX 2D'],
    cast: ['Ryunosuke Kamiki', 'Minami Hamabe', 'Min Tanaka', 'Hidetaka Yoshioka', 'Masami Nagasawa', 'Yuki Yamada', 'Kuranosuke Sasaki', 'Jun Kunimura', 'Sakura Ando', 'Miou Tanaka'],
    synopsis: 'An epic action and horror film blending intense monster destruction with deeply emotional human drama.',
    color: '#344348',
    posterUrl: 'https://assets-in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/godzilla-minus-zero-et00524518-1793193023.jpg'
  },
  {
    title: 'I Play Rocky', language: 'English', languages: ['English'], genre: ['Biography', 'Drama'],
    duration: '2h 10m', rating: '9.2/10', votes: '960+ votes', releaseDate: '2026-11-13', certification: 'A',
    formats: ['2D'],
    cast: ['Anthony Ippolito', 'AnnaSophia Robb', 'Toby Kebbell', 'P. J. Byrne', 'Jay Duplass', 'Matt Dillon', 'Stephan James', 'Tracy Letts', 'Kiki Seto', 'Robert Morgan', 'Saul Stein', 'Trevor St. John', 'Erik Palladino', 'Rob Demery', 'Scot Teller', 'Marla Mindelle'],
    synopsis: 'A heartwarming biographical drama celebrating the incredible underdog spirit behind a truly legendary film franchise.',
    color: '#455261',
    posterUrl: 'https://assets-in.bmscdn.com/discovery-catalog/events/tr:w-400,h-600,bg-CCCCCC,e-usm-2-2-0.5-0.008:w-400.0,h-660.0,cm-pad_resize,bg-000000,fo-top:l-image,i-discovery-catalog@@icons@@star-icon-202203010609.png,lx-24,ly-615,w-29,l-end:l-text,ie-OS4yLzEwICA5NjArIFZvdGVz,fs-29,co-FFFFFF,ly-612,lx-70,pa-8_0_0_0,l-end/et00508520-wzgbxexwvl-portrait.jpg'
  },
  {
    title: 'Lambodhara 2.0', language: 'Kannada', languages: ['Kannada', 'Hindi'], genre: ['Sci-Fi', 'Thriller'],
    duration: '2h 17m', rating: '9.5/10', votes: '820+ votes', releaseDate: '2026-11-13', certification: 'UA13+',
    formats: ['2D'], cast: ['Anil Shetty', 'Saachi Bindra', 'Kunal Kapoor', "Mac D'Souza"],
    synopsis: 'This thrilling Kannada science fiction adventure explores futuristic concepts providing highly engaging, visually stunning entertainment.',
    color: '#34334a',
    posterUrl: 'https://assets-in.bmscdn.com/discovery-catalog/events/tr:w-400,h-600,bg-CCCCCC,e-usm-2-2-0.5-0.008:w-400.0,h-660.0,cm-pad_resize,bg-000000,fo-top:l-image,i-discovery-catalog@@icons@@star-icon-202203010609.png,lx-24,ly-615,w-29,l-end:l-text,ie-OS41LzEwICA4NDArIFZvdGVz,fs-29,co-FFFFFF,ly-612,lx-70,pa-8_0_0_0,l-end/et00524873-atjzslrqzk-portrait.jpg'
  },
  {
    title: 'John Doe', language: 'Tamil', languages: ['Tamil'], genre: ['Crime', 'Psychological', 'Thriller'],
    duration: '2h 29m', rating: '8.9/10', votes: '2.1K+ votes', releaseDate: '2026-11-13', certification: 'UA16+',
    formats: ['2D'],
    cast: ['Arjun Das', 'Sanchana Natarajan', 'Srishti Singh', 'Zaara Vineet', 'Niirav S', 'Badava Gopi', 'Karthik Kumar', 'Anupama Kumar', 'Jayaprakash', 'Archana Chandhoke'],
    synopsis: 'A dark, psychological crime thriller in Tamil that explores an intense and deeply twisted narrative.',
    color: '#3e3940',
    posterUrl: 'https://assets-in.bmscdn.com/discovery-catalog/events/tr:w-400,h-600,bg-CCCCCC,e-usm-2-2-0.5-0.008:w-400.0,h-660.0,cm-pad_resize,bg-000000,fo-top:l-image,i-discovery-catalog@@icons@@star-icon-202203010609.png,lx-24,ly-615,w-29,l-end:l-text,ie-OC45LzEwICAyLjFLKyBWb3Rlcw%3D%3D,fs-29,co-FFFFFF,ly-612,lx-70,pa-8_0_0_0,l-end/et00525702-myeuqlgbcq-portrait.jpg'
  },
  {
    title: 'Premada Oorali', language: 'Kannada', languages: ['Kannada'], genre: ['Drama', 'Romantic'],
    duration: '2h 35m', rating: '9.5/10', votes: '144K+ votes', releaseDate: '2026-09-25', certification: 'UA16+',
    formats: ['2D', 'DOLBY CINEMA 2D'],
    cast: ['Shree Raam', 'Thapaswini Poonacha', 'Ramika Shivu', 'Rangayana Raghu', 'Ila Vitla', 'Govinde Gowda', 'Abhishek Kalmani', 'Abhi Mahesh'],
    synopsis: 'A beautifully crafted Kannada romantic drama filled with heartfelt emotions and incredibly moving, powerful performances.',
    color: '#57404e',
    posterUrl: 'https://assets-in.bmscdn.com/discovery-catalog/events/tr:w-400,h-600,bg-CCCCCC,e-usm-2-2-0.5-0.008:w-400.0,h-660.0,cm-pad_resize,bg-000000,fo-top:l-image,i-discovery-catalog@@icons@@star-icon-202203010609.png,lx-24,ly-615,w-29,l-end:l-text,ie-OS41LzEwICAxNDRLKyBWb3Rlcw%3D%3D,fs-29,co-FFFFFF,ly-612,lx-70,pa-8_0_0_0,l-end/et00412717-wvjrzytadp-portrait.jpg'
  },
  {
    title: 'Shankarabharanna', language: 'Kannada', languages: ['Kannada'], genre: ['Adventure', 'Comedy', 'Horror'],
    duration: '2h 32m', rating: 'Not yet rated', votes: '4K+ interested', releaseDate: '2026-11-20', certification: 'UA16+',
    formats: ['2D'], cast: ['Shine S Shetty', 'Tanvi Ram', 'Deepak Rai Panaje', 'Mime Ramdas'],
    synopsis: 'This highly entertaining Kannada movie perfectly blends adventure, comedy, and horror for a wild ride.',
    color: '#50463d',
    posterUrl: 'https://assets-in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/shankarabharanna-et00523262-1792481378.jpg'
  },
  {
    title: 'Dune: Part Three', language: 'English', languages: ['English', 'Hindi'], genre: ['Action', 'Adventure', 'Drama', 'Sci-Fi'],
    duration: 'Not specified', rating: 'Not yet rated', votes: '81.2K+ interested', releaseDate: '2026-12-18', certification: 'Not specified',
    formats: ['2D', 'IMAX 2D'],
    cast: ['Timothee Chalamet', 'Zendaya', 'Jason Momoa', 'Florence Pugh', 'Rebecca Ferguson', 'Isaach de Bankole', 'Charlotte Rampling', 'Anya Taylor-Joy', 'Robert Pattinson', 'Javier Bardem', 'Josh Brolin', 'Nakoa-Wolf Momoa', 'Ida Brooke'],
    synopsis: 'Paul Atreides confronts massive new threats and intense emotional challenges in this amazing cinematic conclusion.',
    color: '#645137',
    posterUrl: 'https://assets-in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/dune-part-three-et00491771-1794656996.jpg'
  },
  {
    title: 'Nee Nange Allava', language: 'Kannada', languages: ['Kannada'], genre: ['Drama', 'Romantic'],
    duration: '2h 11m', rating: '10/10', votes: '390+ votes', releaseDate: '2026-11-13', certification: 'UA16+',
    formats: ['2D'], cast: ['Rahul Arcot', 'Kaashima Rafi', 'Manjunath Hegde', 'Ravi Prakash', 'Vinod Bharathi'],
    synopsis: 'An acclaimed Kannada romantic drama delivering a perfect score through a deeply touching, unforgettable story.',
    color: '#563f52',
    posterUrl: 'https://assets-in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/nee-nange-allava-et00524561-1793258004.jpg'
  }
].map((m, i) => ({ ...m, rank: i + 1, homeVisible: true }));

const theatres = [
  { name: 'Venkateshwara Theatre', chain: 'Venkateshwara Theatre', area: 'Kengeri Satellite Town', address: 'Kengeri Satellite Town, Bengaluru', amenities: ['Digital Projection', 'DTS'], rating: 3.9, homeVisible: true },
  { name: 'Gopalan Cinemas: Arcade Mall', chain: 'Gopalan Cinemas', area: 'RR Nagar', address: 'RR Nagar, Bengaluru', amenities: ['Dolby Atmos', 'Recliners'], rating: 4.2, homeVisible: true },
  { name: 'PVR: Global Mall', chain: 'PVR Cinemas', area: 'Nayandahalli (Mysore Road)', address: 'Nayandahalli, Bengaluru', amenities: ['4K', 'Dolby Atmos'], screenCount: 3, rating: 4.2, homeVisible: true },
  { name: 'Robin Theatre', chain: 'Robin Theatre', area: 'Kengeri Satellite Town', address: 'Kengeri Satellite Town, Bengaluru', amenities: ['Single Screen', 'Canteen', '4K', 'Dolby Atmos'], screenCount: 1, rating: 3.9, homeVisible: true },
  { name: 'PVR Superplex (Forum South Bengaluru)', chain: 'PVR Cinemas', area: 'Kanakapura Road', address: 'Forum South Bengaluru, Kanakapura Road, Bengaluru', amenities: ['P[XL] Laser', 'LUXE', 'Dolby Atmos'], screenCount: 2, homeVisible: true },
  { name: 'INOX Megaplex (Phoenix Mall of Asia)', chain: 'INOX', area: 'Byatarayanapura', address: 'Phoenix Mall of Asia, Byatarayanapura, Bengaluru', amenities: ['Insignia', 'Laser Projection'], screenCount: 3, homeVisible: true },
  { name: 'AMB Cinemas Kapali', chain: 'AMB Cinemas', area: 'Gandhinagar', address: 'Gandhinagar, Bengaluru', amenities: ['Dolby Cinema', 'Dolby Vision', 'Dolby Atmos'], screenCount: 2, homeVisible: true },
  { name: 'PVR Orion Mall', chain: 'PVR Cinemas', area: 'Rajajinagar', address: 'Dr Rajkumar Road, Rajajinagar, Bengaluru', amenities: ['P[XL]', 'Dolby Atmos'], screenCount: 4, screenCountIsMinimum: true, homeVisible: true },
  { name: 'INOX Mantri Square', chain: 'INOX', area: 'Malleshwaram', address: 'Mantri Square, Malleshwaram, Bengaluru', amenities: ['Insignia', 'Laser Projection'], screenCount: 3, homeVisible: true },
  { name: 'PVR Nexus (Koramangala)', chain: 'PVR Cinemas', area: 'Koramangala', address: 'Nexus Mall, Koramangala, Bengaluru', amenities: ['IMAX with Laser'], screenCount: 12, screenCountIsMinimum: true, homeVisible: true },
  { name: 'Cinépolis Nexus Shantiniketan', chain: 'Cinépolis', area: 'Thigalarapalya', address: 'Nexus Shantiniketan, Thigalarapalya, Whitefield, Bengaluru', amenities: ['Dolby Atmos'], screenCount: 3, screenCountIsMinimum: true, homeVisible: true },
  { name: "PVR Director's Cut (Forum Rex Walk)", chain: 'PVR Cinemas', area: 'Brigade Road', address: 'Forum Rex Walk, Brigade Road, Bengaluru', amenities: ['4K Laser Projection'], screenCount: 3, homeVisible: true },
  { name: 'Vinayaka Cineluxe', chain: 'Vinayaka Cineluxe', area: 'Marathahalli', address: 'Marathahalli, Bengaluru', amenities: ['4K RGB Laser', 'Dolby Atmos'], homeVisible: true },
  { name: 'Lakshmi Cinema', chain: 'Lakshmi Cinema', area: 'Tavarekere', address: 'Tavarekere, Bengaluru', amenities: ['4K Dolby Atmos RGB Laser'], homeVisible: true },
  { name: 'Venkateshwara A/c', chain: 'Venkateshwara', area: 'Devasandra', address: 'Devasandra, Bengaluru', amenities: ['4K', 'Dolby Atmos'], homeVisible: true },
  { name: 'Sri Thirumala', chain: 'Sri Thirumala', area: 'HSR Layout', address: 'HSR Layout, Bengaluru', amenities: ['4K', 'Dolby Atmos'], homeVisible: true },
  { name: 'Roopa Cinema', chain: 'Roopa Cinema', area: 'Nelamangala', address: 'Nelamangala, Bengaluru', amenities: ['4K', 'Dolby Atmos'], homeVisible: true },
  { name: 'Mukunda', chain: 'Mukunda', area: 'Banaswadi', address: 'Banaswadi, Bengaluru', amenities: ['4K', 'Dolby Atmos'], homeVisible: true },
  { name: 'Sri Vajreshwari Cinemas', chain: 'Sri Vajreshwari Cinemas', area: 'Ullalu', address: 'Ullalu, Bengaluru', amenities: ['4K', 'Dolby Atmos'], homeVisible: true },
  { name: 'Siddeshwara Cinema', chain: 'Siddeshwara Cinema', area: 'JP Nagar', address: 'JP Nagar, Bengaluru', amenities: ['4K', 'Dolby Atmos'], homeVisible: true },
  { name: 'Kamakya Cinema', chain: 'Kamakya Cinema', area: 'Banashankari', address: 'Banashankari, Bengaluru', amenities: ['4K', 'Dolby Atmos'], homeVisible: true },
  { name: 'Sri Balaji', chain: 'Sri Balaji', area: 'Dommasandra', address: 'Dommasandra, Bengaluru', amenities: ['4K', 'Dolby Atmos'], homeVisible: true },
  { name: 'Venkateshwara Digital', chain: 'Venkateshwara', area: 'Kengeri Fort Road', address: 'Kengeri Fort Road, Bengaluru', amenities: ['4K', 'Dolby Atmos'], homeVisible: true },
  { name: 'PVR Vega City', chain: 'PVR Cinemas', area: 'Bannerghatta Road', address: 'Vega City Mall, Bannerghatta Road, Bengaluru', amenities: [], screenCount: 2, screenCountIsMinimum: true, homeVisible: true },
  { name: 'PVR VR Bengaluru', chain: 'PVR Cinemas', area: 'Whitefield Road', address: 'VR Bengaluru, Whitefield Road, Bengaluru', amenities: [], screenCount: 3, homeVisible: true },
  { name: 'Cinépolis ETA Namma Mall', chain: 'Cinépolis', area: 'Binny Pete', address: 'ETA Namma Mall, Binny Pete, Bengaluru', amenities: [], screenCount: 4, screenCountIsMinimum: true, homeVisible: true },
  { name: 'PVR Bhartiya Mall of Bengaluru', chain: 'PVR Cinemas', area: 'Bhartiya City Mall', address: 'Bhartiya City Mall, Bengaluru', amenities: [], screenCount: 4, homeVisible: true },
  { name: 'PVR Central Spirit Mall', chain: 'PVR Cinemas', area: 'Bellandur', address: 'Central Spirit Mall, Bellandur, Bengaluru', amenities: [], screenCount: 2, homeVisible: true },
  { name: 'Cinépolis Royal Meenakshi Mall', chain: 'Cinépolis', area: 'Bannerghatta Road', address: 'Royal Meenakshi Mall, Bannerghatta Road, Bengaluru', amenities: [], screenCount: 2, homeVisible: true },
  { name: 'Cinépolis SJR Spectrum Central Mall', chain: 'Cinépolis', area: 'Bannerghatta Road', address: 'SJR Spectrum Central Mall, Bannerghatta Road, Bengaluru', amenities: [], screenCount: 4, homeVisible: true },
  { name: 'Miraj Cinemas TGN Lotus Elite', chain: 'Miraj Cinemas', area: 'TGN Lotus Elite', address: 'TGN Lotus Elite, Bengaluru', amenities: [], screenCount: 2, homeVisible: true },
  { name: 'PVR Vaishnavi Sapphire Mall', chain: 'PVR Cinemas', area: 'Yeshwantpur', address: 'Vaishnavi Sapphire Mall, Yeshwantpur, Bengaluru', amenities: [], screenCount: 3, homeVisible: true },
  { name: 'Cinépolis Orion Avenue Mall', chain: 'Cinépolis', area: 'Banaswadi', address: 'Orion Avenue Mall, Banaswadi, Bengaluru', amenities: [], screenCount: 2, homeVisible: true },
  { name: 'Movietime Cinemas YGR Signature Mall', chain: 'Movietime Cinemas', area: 'RR Nagar', address: 'YGR Signature Mall, RR Nagar, Bengaluru', amenities: [], screenCount: 2, homeVisible: true }
];

(async () => {
  await mongoose.connect(K.MONGO_URI);
  const upsertMany = (Model, docs, key) => Promise.all(docs.map(doc => Model.findOneAndUpdate(
    key(doc), doc, { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  )));
  const ms = await upsertMany(Movie, movies, m => ({ title: m.title }));
  const ts = await upsertMany(Theatre, theatres, t => ({ name: t.name, address: t.address }));
  const screenConfigs = ts.flatMap(theatre => {
    const screenCount = Math.min(theatre.screenCount || 4, 4);
    return Array.from({ length: screenCount }, (_, index) => {
      const layout = generateSeatLayout(DEFAULT_LAYOUT_CONFIG);
      return {
        theatre: theatre._id,
        name: `Screen ${index + 1}`,
        format: 'Multi-format',
        rows: layout.map(row => row.label),
        layout,
        columns: Math.max(...layout.map(row => row.cells.length)),
        totalSeats: layout.reduce((total, row) => total + row.cells.filter(cell => cell.type === 'seat').length, 0),
        isActive: true
      };
    });
  });
  const screenDocs = await upsertMany(Screen, screenConfigs, screen => ({ theatre: screen.theatre, name: screen.name }));
  const screenByTheatreAndName = new Map(screenDocs.map(screen => [`${screen.theatre}|${screen.name}`, screen]));
  const seatRecords = screenDocs.flatMap(screen => getSeatRecords(screen._id, screen.layout));
  for (let offset = 0; offset < seatRecords.length; offset += 1000) {
    const batch = seatRecords.slice(offset, offset + 1000);
    await Seat.bulkWrite(batch.map(seat => ({
      updateOne: {
        filter: { screen: seat.screen, row: seat.row, number: seat.number },
        update: { $set: { ...seat, isActive: true } },
        upsert: true
      }
    })), { ordered: false });
  }
  await Show.bulkWrite(screenDocs.map(screen => ({
    updateMany: {
      filter: { theatre: screen.theatre, screen: screen.name, screenRef: { $ne: screen._id } },
      update: { $set: { screenRef: screen._id } }
    }
  })), { ordered: false });
  const screenFor = (theatre, screenNumber) => {
    const name = `Screen ${screenNumber}`;
    const theatreId = theatre?._id || theatre;
    return { screen: name, screenRef: screenByTheatreAndName.get(`${theatreId}|${name}`)?._id };
  };
  const movieById = new Map(ms.map(movie => [String(movie._id), movie]));
  const times = ['10:00', '13:30', '16:45', '20:15'];
  const coverageTimes = [
    '08:20', '09:30', '09:45', '10:15', '10:20', '10:30', '11:15', '11:40',
    '12:50', '13:20', '13:50', '14:10', '14:20', '14:25', '17:40', '17:55',
    '18:10', '18:20', '18:25', '21:00', '21:30', '22:00', '22:20', '22:30'
  ];
  const shows = [];
  const showVariants = new Map(ms.map(m => {
    const languages = (m.languages || []).filter(language => !/^\+\d+$/.test(language));
    const availableLanguages = languages.length ? languages : [m.language];
    const variants = availableLanguages.flatMap(language => {
      const localizedFormats = m.languageFormats?.find(entry => entry.language === language)?.formats;
      const formats = localizedFormats?.length ? localizedFormats : m.formats;
      return formats.map(format => ({ language, format }));
    });
    return [String(m._id), variants];
  }));
  const showVariantIndexes = new Map();
  const pad = n => String(n).padStart(2, '0');
  const scheduleDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() + index);
    return {
      day,
      date: `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
    };
  });
  const existingShows = await Show.find({
    movie: { $in: ms.map(movie => movie._id) },
    date: { $in: scheduleDays.map(({ date }) => date) }
  }).select('movie theatre date time screen language').lean();
  const entriesByDate = new Map(scheduleDays.map(({ date }) => [date, new Map()]));
  const showIdentity = show => `${show.movie}|${show.theatre}|${show.date}|${show.time}|${show.screen}`;
  existingShows.forEach(show => entriesByDate.get(show.date).set(showIdentity(show), show));
  const theatreById = new Map((await Theatre.find().select('_id screenCount').lean()).map(theatre => [String(theatre._id), theatre]));

  for (let d = 0; d < 7; d++) {
    const { day, date } = scheduleDays[d];
    const entries = entriesByDate.get(date);
    ts.forEach((t, ti) => ms.forEach((m, mi) => {
      if (m.releaseDate && m.releaseDate > date) return;
      if ((mi + ti) % 2) return; // not every movie in every theatre
      times.forEach((time, k) => {
        if ((mi + k) % 3 === 0) return;
        const [h, mn] = time.split(':').map(Number);
        const startsAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mn);
        const key = String(m._id);
        const index = showVariantIndexes.get(key) || 0;
        const variant = showVariants.get(key)[index % showVariants.get(key).length];
        const show = {
          movie: m._id,
          theatre: t._id,
          ...screenFor(t._id, 1 + ((mi + k) % Math.min(t.screenCount || 4, 4))),
          ...variant,
          date,
          time,
          startsAt
        };
        shows.push(show);
        entries.set(showIdentity(show), show);
        showVariantIndexes.set(key, index + 1);
      });
    }));
    const showCounts = new Map();
    const occupiedTimes = new Map();
    const theatresByMovieLanguage = new Map();
    entries.forEach(show => {
      const movieId = String(show.movie);
      const theatreId = String(show.theatre);
      const language = show.language || movieById.get(movieId)?.language;
      if (!language) return;
      const groupKey = `${movieId}|${theatreId}|${language}`;
      const slotKey = `${movieId}|${theatreId}`;
      const languageKey = `${movieId}|${language}`;
      showCounts.set(groupKey, (showCounts.get(groupKey) || 0) + 1);
      if (!occupiedTimes.has(slotKey)) occupiedTimes.set(slotKey, new Set());
      occupiedTimes.get(slotKey).add(show.time);
      if (!theatresByMovieLanguage.has(languageKey)) theatresByMovieLanguage.set(languageKey, new Set());
      theatresByMovieLanguage.get(languageKey).add(theatreId);
    });
    ms.forEach((m, mi) => {
      if (m.releaseDate && m.releaseDate > date) return;
      const key = String(m._id);
      const variants = showVariants.get(key);
      const languages = [...new Set(variants.map(variant => variant.language))];
      const theatreCoverage = Math.min(8, ts.length);
      languages.forEach((language, languageIndex) => {
        const languageVariants = variants.filter(variant => variant.language === language);
        for (let theatreIndex = 0; theatreIndex < theatreCoverage; theatreIndex++) {
          const theatrePosition = (d * theatreCoverage + languageIndex * theatreCoverage + theatreIndex) % ts.length;
          const theatre = ts[theatrePosition];
          const groupKey = `${key}|${theatre._id}|${language}`;
          if ((showCounts.get(groupKey) || 0) >= 3) continue;
          const variant = languageVariants[(d + theatreIndex) % languageVariants.length];
          const slotKey = `${key}|${theatre._id}`;
          const usedTimes = occupiedTimes.get(slotKey) || new Set();
          const startIndex = (d * 3 + languageIndex * 5 + theatrePosition * 7) % coverageTimes.length;
          let time;
          for (let offset = 0; offset < coverageTimes.length; offset++) {
            const candidate = coverageTimes[(startIndex + offset) % coverageTimes.length];
            if (!usedTimes.has(candidate)) {
              time = candidate;
              break;
            }
          }
          if (!time) throw new Error(`No free showtime slots for ${m.title}, ${language}, ${date}`);
          const [h, mn] = time.split(':').map(Number);
          const show = {
            movie: m._id,
            theatre: theatre._id,
            ...screenFor(theatre._id, 1 + ((mi + languageIndex + theatreIndex) % Math.min(theatre.screenCount || 4, 4))),
            ...variant,
            date,
            time,
            startsAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mn)
          };
          shows.push(show);
          entries.set(showIdentity(show), show);
          usedTimes.add(time);
          occupiedTimes.set(slotKey, usedTimes);
          showCounts.set(groupKey, (showCounts.get(groupKey) || 0) + 1);
          const languageKey = `${key}|${language}`;
          if (!theatresByMovieLanguage.has(languageKey)) theatresByMovieLanguage.set(languageKey, new Set());
          theatresByMovieLanguage.get(languageKey).add(String(theatre._id));
        }
      });
      languages.forEach((language, languageIndex) => {
        const languageVariants = variants.filter(variant => variant.language === language);
        const languageKey = `${key}|${language}`;
        const theatreIds = new Set(theatresByMovieLanguage.get(languageKey) || []);
        for (let theatreIndex = 0; theatreIndex < theatreCoverage; theatreIndex++) {
          const theatrePosition = (d * theatreCoverage + languageIndex * theatreCoverage + theatreIndex) % ts.length;
          theatreIds.add(String(ts[theatrePosition]._id));
        }
        [...theatreIds].sort().forEach((theatreId, theatreIndex) => {
          const theatre = theatreById.get(theatreId);
          if (!theatre) return;
          const groupKey = `${key}|${theatreId}|${language}`;
          const slotKey = `${key}|${theatreId}`;
          let count = showCounts.get(groupKey) || 0;
          if (count > 6) throw new Error(`More than six showtimes already exist for ${m.title}, ${language}, ${date}`);
          while (count < 3) {
            const usedTimes = occupiedTimes.get(slotKey) || new Set();
            const startIndex = (d * 3 + mi * 5 + languageIndex * 7 + theatreIndex * 11 + count * 13) % coverageTimes.length;
            let time;
            for (let offset = 0; offset < coverageTimes.length; offset++) {
              const candidate = coverageTimes[(startIndex + offset) % coverageTimes.length];
              if (!usedTimes.has(candidate)) {
                time = candidate;
                break;
              }
            }
            if (!time) throw new Error(`No free showtime slots for ${m.title}, ${language}, ${date}`);
            const [h, mn] = time.split(':').map(Number);
            const variant = languageVariants[(d + theatreIndex + count) % languageVariants.length];
            const show = {
              movie: m._id,
              theatre: theatreId,
              ...screenFor(theatreId, 1 + ((mi + languageIndex + theatreIndex + count) % Math.min(theatre.screenCount || 4, 4))),
              ...variant,
              date,
              time,
              startsAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mn)
            };
            shows.push(show);
            entries.set(showIdentity(show), show);
            usedTimes.add(time);
            occupiedTimes.set(slotKey, usedTimes);
            count++;
            showCounts.set(groupKey, count);
          }
        });
      });
    });
  }
  await upsertMany(Show, shows, s => ({ movie: s.movie, theatre: s.theatre, date: s.date, time: s.time, screen: s.screen }));
  console.log(`Seeded or updated ${ms.length} movies, ${ts.length} theatres, ${screenDocs.length} screens, ${seatRecords.length} seats, ${shows.length} shows`);
  process.exit(0);
})();
