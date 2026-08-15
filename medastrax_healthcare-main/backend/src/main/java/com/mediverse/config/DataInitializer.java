package com.mediverse.config;

import com.mediverse.model.Hospital;
import com.mediverse.model.Order;
import com.mediverse.model.PatientProfile;
import com.mediverse.model.User;
import com.mediverse.model.Booking;
import com.mediverse.model.Prescription;
import com.mediverse.repository.OrderRepository;
import com.mediverse.repository.PatientProfileRepository;
import com.mediverse.repository.HospitalRepository;
import com.mediverse.repository.UserRepository;
import com.mediverse.repository.BookingRepository;
import com.mediverse.repository.PrescriptionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private HospitalRepository hospitalRepository;

    @Autowired
    private PatientProfileRepository patientProfileRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private EntityManager entityManager;

    private String encodedPassword;

    @Override
    @Transactional
    public void run(String... args) {
        this.encodedPassword = passwordEncoder.encode("password123");
        // Drop check constraint on role if exists (Postgres)
        try {
            entityManager.createNativeQuery("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check").executeUpdate();
            System.out.println("✅ Database role check constraint dropped.");
        } catch (Exception e) {
            System.out.println("⚠️ Warning: Drop constraint failed: " + e.getMessage());
        }

        // Initialize variables to hold users for hospital/booking/order seeding
        User patient = null;
        User doctor1 = null;
        User doctor2 = null;
        User hospitalUser = null;

        try {
            // Demo Patient
            if (!userRepository.existsByEmail("patient@demo.com")) {
                patient = User.builder()
                        .name("Rahul Sharma")
                        .email("patient@demo.com")
                        .password(encodedPassword)
                        .phone("+91 7827472924")
                        .role(User.Role.PATIENT)
                        .city("Mumbai")
                        .address("Andheri West, Mumbai")
                        .upiId("patient@oksbi")
                        .build();
                patient = userRepository.save(patient);

                PatientProfile patientProfile = new PatientProfile();
                patientProfile.setUser(patient);
                patientProfile.setDob("1992-08-15");
                patientProfile.setAge(33);
                patientProfile.setGender("Male");
                patientProfile.setBloodGroup("O+");
                patientProfile.setEmergencyNumber("+91 7827472924");
                patientProfile.setPreferredLanguage("Hindi");
                patientProfile.setExistingMedicalCondition("Mild Asthma");
                patientProfile.setIdProof("Aadhar-1234-5678-9012");
                patientProfile.setCurrentMedication("Inhaler when needed");
                patientProfile.setAllergies("Dust, Pollen");
                patientProfile.setIsFirstTimeUser(false);
                patientProfile.setHospitalPreference("Government Hospital,Private Hospital");
                patientProfileRepository.save(patientProfile);
            } else {
                patient = userRepository.findByEmail("patient@demo.com").orElse(null);
            }

            // Demo Doctor 1
            if (!userRepository.existsByEmail("doctor@demo.com")) {
                doctor1 = User.builder()
                        .name("Dr. Priya Patel")
                        .email("doctor@demo.com")
                        .password(encodedPassword)
                        .phone("+91 9876543211")
                        .role(User.Role.DOCTOR)
                        .city("Mumbai")
                        .address("Bandra, Mumbai")
                        .upiId("drpriya@hdfcbank")
                        .build();
                doctor1 = userRepository.save(doctor1);
            } else {
                doctor1 = userRepository.findByEmail("doctor@demo.com").orElse(null);
            }

            // Demo Doctor 2
            if (!userRepository.existsByEmail("doctor2@demo.com")) {
                doctor2 = User.builder()
                        .name("Dr. Amit Kumar")
                        .email("doctor2@demo.com")
                        .password(encodedPassword)
                        .phone("+91 9876543212")
                        .role(User.Role.DOCTOR)
                        .city("Delhi")
                        .address("Connaught Place, Delhi")
                        .upiId("dramit@okaxis")
                        .build();
                doctor2 = userRepository.save(doctor2);
            } else {
                doctor2 = userRepository.findByEmail("doctor2@demo.com").orElse(null);
            }

            // Demo Pharmacy
            if (!userRepository.existsByEmail("pharmacy@demo.com")) {
                User pharmacy = User.builder()
                        .name("MedPlus Pharmacy")
                        .email("pharmacy@demo.com")
                        .password(encodedPassword)
                        .phone("+91 9876543213")
                        .role(User.Role.PHARMACY)
                        .city("Mumbai")
                        .address("Dadar, Mumbai")
                        .upiId("medplus@icici")
                        .build();
                userRepository.save(pharmacy);
            }

            // Demo Lab
            if (!userRepository.existsByEmail("lab@demo.com")) {
                User lab = User.builder()
                        .name("Alfa Diagnostic Lab")
                        .email("lab@demo.com")
                        .password(encodedPassword)
                        .phone("+91 9876543214")
                        .role(User.Role.LAB)
                        .city("Mumbai")
                        .address("Colaba, Mumbai")
                        .upiId("alfalab@upi")
                        .licenseNo("29105")
                        .build();
                userRepository.save(lab);
            }

            // Demo Hospital Manager User
            if (!userRepository.existsByEmail("hospital@demo.com")) {
                hospitalUser = User.builder()
                        .name("City Care Hospital Manager")
                        .email("hospital@demo.com")
                        .password(encodedPassword)
                        .phone("+91 22-12345678")
                        .role(User.Role.HOSPITAL)
                        .city("Mumbai")
                        .address("123, MG Road, Bandra West")
                        .upiId("citycare@oksbi")
                        .build();
                hospitalUser = userRepository.save(hospitalUser);
            } else {
                hospitalUser = userRepository.findByEmail("hospital@demo.com").orElse(null);
            }

            // Demo Admin User
            if (!userRepository.existsByEmail("admin@demo.com")) {
                User adminUser = User.builder()
                        .name("System Admin")
                        .email("admin@demo.com")
                        .password(encodedPassword)
                        .phone("+91 9999999999")
                        .role(User.Role.ADMIN)
                        .city("Mumbai")
                        .address("Mediverse HQ")
                        .build();
                userRepository.save(adminUser);
            }


            // Seed Hospitals and related items only if no hospitals are seeded
            if (hospitalRepository.count() == 0) {
                // Demo Hospital 1
                Hospital hospital1 = Hospital.builder()
                        .registrationNo("HSP01")
                        .hospitalType("Private Hospital")
                        .name("City Care Hospital")
                        .address("123, MG Road, Bandra West")
                        .city("Mumbai")
                        .state("Maharashtra")
                        .pincode("400050")
                        .phone("+91 22-12345678")
                        .email("info@citycare.com")
                        .latitude(19.0596)
                        .longitude(72.8295)
                        .images("[\"https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800\",\"https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800\"]")
                        .facilities("[\"ICU\",\"Emergency\",\"Pharmacy\",\"Lab\",\"Radiology\",\"OPD\",\"Surgery\"]")
                        .doctorTypes(
                                "[\"Dermatologist\",\"ENT Specialist\",\"Ophthalmologist\",\"Gynecologist\",\"Urologist\",\"General Physician\",\"Cardiologist\",\"Neurologist\",\"Pediatrician\"]")
                        .totalBeds(200)
                        .availableBeds(45)
                        .consultationRate(new BigDecimal("500"))
                        .description(
                                "City Care Hospital is a premier multi-specialty hospital providing world-class healthcare services. Our team of experienced doctors and state-of-the-art facilities ensure the best treatment for all patients.")
                        .doctor(doctor1)
                        .rating(4.5)
                        .verified(true)
                        .build();
                hospital1 = hospitalRepository.save(hospital1);
                seedDoctorsForHospital(hospital1, new String[]{"Dermatologist", "ENT Specialist", "Ophthalmologist", "Gynecologist", "Urologist", "General Physician", "Cardiologist", "Neurologist"});

                hospitalUser.setHospitalId(hospital1.getId());
                userRepository.save(hospitalUser);

                // Demo Hospital 2
                Hospital hospital2 = Hospital.builder()
                        .registrationNo("HSP02")
                        .hospitalType("Government Hospital")
                        .name("LifeLine Medical Center")
                        .address("456, Ring Road, Connaught Place")
                        .city("Delhi")
                        .state("Delhi")
                        .pincode("110001")
                        .phone("+91 11-87654321")
                        .email("info@lifeline.com")
                        .latitude(28.6315)
                        .longitude(77.2167)
                        .images("[\"https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800\",\"https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800\"]")
                        .facilities("[\"ICU\",\"Emergency\",\"Pharmacy\",\"Lab\",\"MRI\",\"CT Scan\",\"OPD\"]")
                        .doctorTypes(
                                "[\"Dermatologist\",\"ENT Specialist\",\"Ophthalmologist\",\"Gynecologist\",\"Urologist\",\"General Physician\",\"Cardiologist\",\"Neurologist\",\"Pediatrician\"]")
                        .totalBeds(150)
                        .availableBeds(30)
                        .consultationRate(new BigDecimal("700"))
                        .description(
                                "LifeLine Medical Center offers comprehensive healthcare with cutting-edge technology. We are dedicated to providing compassionate care and innovative treatments.")
                        .doctor(doctor2)
                        .rating(4.2)
                        .verified(true)
                        .build();
                hospital2 = hospitalRepository.save(hospital2);
                seedDoctorsForHospital(hospital2, new String[]{"Dermatologist", "ENT Specialist", "Ophthalmologist", "Gynecologist", "Urologist", "General Physician", "Cardiologist", "Neurologist"});

                // Demo Hospital 3
                Hospital hospital3 = Hospital.builder()
                        .registrationNo("HSP03")
                        .hospitalType("NGO-run Hospital")
                        .name("Green Valley Hospital")
                        .address("789, Park Street")
                        .city("Mumbai")
                        .state("Maharashtra")
                        .pincode("400001")
                        .phone("+91 22-11223344")
                        .email("info@greenvalley.com")
                        .latitude(18.9322)
                        .longitude(72.8264)
                        .images("[\"https://images.unsplash.com/photo-1551076805-e1869033e561?w=800\",\"https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800\"]")
                        .facilities("[\"ICU\",\"Emergency\",\"Pharmacy\",\"Lab\",\"Physiotherapy\",\"Dialysis\"]")
                        .doctorTypes("[\"Dermatologist\",\"ENT Specialist\",\"Ophthalmologist\",\"Gynecologist\",\"Urologist\",\"General Physician\",\"Cardiologist\",\"Neurologist\",\"Pediatrician\"]")
                        .totalBeds(100)
                        .availableBeds(22)
                        .consultationRate(new BigDecimal("400"))
                        .description(
                                "Green Valley Hospital is known for its affordable yet quality healthcare services. Our patient-first approach ensures comfortable recovery.")
                        .doctor(doctor1)
                        .rating(4.0)
                        .verified(true)
                        .build();
                hospital3 = hospitalRepository.save(hospital3);
                seedDoctorsForHospital(hospital3, new String[]{"Dermatologist", "ENT Specialist", "Ophthalmologist", "Gynecologist", "Urologist", "General Physician", "Cardiologist", "Neurologist"});

                // Create a Demo Completed Online Booking with AI Report & Previous Prescription
                // Summary
                Booking demoBooking = Booking.builder()
                        .patient(patient)
                        .doctor(doctor1)
                        .hospital(hospital1)
                        .bookingDate(LocalDate.now().minusDays(1))
                        .timeSlot("10:00 AM - 10:30 AM")
                        .status(Booking.BookingStatus.COMPLETED)
                        .type(Booking.BookingType.ONLINE)
                        .patientName(patient.getName())
                        .patientPhone(patient.getPhone())
                        .age(33)
                        .gender("Male")
                        .symptoms("Shortness of breath, dry cough, wheezing")
                        .paymentMethod("UPI")
                        .paymentStatus("PAID")
                        .previousPrescriptionSummary(
                                "# AI Analyzed Previous Prescription Summary\n\n- **Prescribed Medicine**: Levocetirizine 5mg once daily for allergic rhinitis.\n- **Reported Allergies**: Dust, pollen.")
                        .build();
                demoBooking.setAiReport(
                        "# Clinical Consultation Summary\n\n## Symptoms & History\n- Patient experiences acute wheezing and chest tightness for the the past 2 days.\n- Previous history of mild asthma.\n\n## Examination Findings\n- Lungs: Bilateral wheezing present.\n\n## Clinical Recommendations\n- **Inhaler therapy**: Continue Albuterol as needed.\n- **Daily Controller**: Start Montelukast 10mg once daily.\n- **Diagnostics**: Recommended Spirometry Test.");
                demoBooking = bookingRepository.save(demoBooking);

                // Create a Prescription linked to that booking
                Prescription demoPrescription = Prescription.builder()
                        .booking(demoBooking)
                        .patient(patient)
                        .doctor(doctor1)
                        .diagnosis("Asthma Exacerbation")
                        .notes("Avoid dusty areas. Use inhaler twice daily if symptoms worsen.")
                        .medicines(
                                "[{\"name\":\"Albuterol Inhaler\",\"dosage\":\"100 mcg\",\"frequency\":\"1-2 puffs as needed\",\"duration\":\"5 days\"},{\"name\":\"Montelukast\",\"dosage\":\"10 mg\",\"frequency\":\"Once daily at evening\",\"duration\":\"10 days\"}]")
                        .tests("[{\"testName\":\"Spirometry Test\",\"reason\":\"To assess lung capacity and asthma control\"}]")
                        .status(Prescription.PrescriptionStatus.COMPLETED)
                        .routeType(Prescription.RouteType.NONE)
                        .build();
                prescriptionRepository.save(demoPrescription);

                // Seed 12 mock orders for the pharmacy dashboard
                String[] regions = { "Andheri West, Mumbai", "Bandra West, Mumbai", "Colaba, Mumbai", "Dadar, Mumbai",
                        "Powai, Mumbai", "Juhu, Mumbai" };
                String[] medicinesList = {
                        "[{\"name\":\"Paracetamol\",\"quantity\":10,\"unitPrice\":10},{\"name\":\"Cetirizine\",\"quantity\":15,\"unitPrice\":6}]",
                        "[{\"name\":\"Amoxicillin\",\"quantity\":10,\"unitPrice\":24},{\"name\":\"Pantoprazole\",\"quantity\":10,\"unitPrice\":16}]",
                        "[{\"name\":\"Metformin\",\"quantity\":30,\"unitPrice\":8},{\"name\":\"Atorvastatin\",\"quantity\":10,\"unitPrice\":30}]",
                        "[{\"name\":\"Ibuprofen\",\"quantity\":20,\"unitPrice\":12}]",
                        "[{\"name\":\"Azithromycin\",\"quantity\":6,\"unitPrice\":50},{\"name\":\"Pantoprazole\",\"quantity\":10,\"unitPrice\":16}]",
                        "[{\"name\":\"Albuterol Inhaler\",\"quantity\":2,\"unitPrice\":125},{\"name\":\"Montelukast\",\"quantity\":10,\"unitPrice\":10}]"
                };
                Double[] medAmounts = { 190.0, 400.0, 540.0, 240.0, 460.0, 350.0 };
                String[] statuses = { "DELIVERED", "COMPLETED", "DELIVERED", "DELIVERED", "PENDING", "PREPARING",
                        "DELIVERING", "COMPLETED", "DELIVERED", "DELIVERED", "COMPLETED", "DELIVERED" };

                for (int i = 0; i < 12; i++) {
                    Order order = new Order();
                    order.setPatient(patient);
                    order.setPharmacyName("MedPlus Pharmacy");

                    int index = i % medicinesList.length;
                    order.setMedicinesJson(medicinesList[index]);
                    order.setDeliveryAddress(regions[i % regions.length]);
                    order.setStatus(statuses[i]);

                    Double medAmt = medAmounts[index];
                    Double delChg = 20.0 + (i * 5.0) % 50.0;
                    order.setMedicineAmount(medAmt);
                    order.setDeliveryCharges(delChg);
                    order.setTotalAmount(medAmt + delChg);
                    order.setCreatedAt(LocalDateTime.now().minusDays(i).minusHours(i * 2));

                    orderRepository.save(order);
                }

                seedHospitals(doctor1);
            }

            System.out.println("✅ Demo data initialized successfully!");
                System.out.println("📧 Demo Accounts:");
                System.out.println("   Patient: patient@demo.com / password123");
                System.out.println("   Doctor:  doctor@demo.com / password123");
                System.out.println("   Doctor2: doctor2@demo.com / password123");
                System.out.println("   Pharmacy: pharmacy@demo.com / password123");
                System.out.println("   Lab:      lab@demo.com / password123");
                System.out.println("   Hospital:      hospital@demo.com / password123");
                System.out.println("   Admin:         admin@demo.com / password123");
            } catch (Exception e) {
                System.out.println("⚠️ Demo data initialization skipped (data may already exist): " + e.getMessage());
            }
    }

    private void seedHospitals(User doctor) {
        String[] cities = { "Delhi", "Chandigarh", "Hyderabad", "Mumbai", "Pune", "Bangalore" };
        double[][] centers = {
                { 28.6139, 77.2090 }, // Delhi
                { 30.7333, 76.7794 }, // Chandigarh
                { 17.3850, 78.4867 }, // Hyderabad
                { 19.0760, 72.8777 }, // Mumbai
                { 18.5204, 73.8567 }, // Pune
                { 12.9716, 77.5946 } // Bangalore
        };
        String[] states = { "Delhi", "Chandigarh", "Telangana", "Maharashtra", "Maharashtra", "Karnataka" };

        String[] namePrefixes = { "Apollo", "Fortis", "Max", "Manipal", "Aster", "Narayana", "Care", "KIMS",
                "Wockhardt", "Global", "Sahyadri", "Ruby Hall", "Medanta", "Columbia Asia", "HCG", "Rainbow" };
        String[] nameSuffixes = { "Hospital", "Medical Center", "Super Specialty Hospital", "Healthcare",
                "Inst. of Medical Sciences", "Multi-Specialty Clinic" };

        String[][] facilitiesPool = {
                { "ICU", "Emergency", "Pharmacy", "Lab", "Radiology", "OPD", "Surgery" },
                { "ICU", "Emergency", "Pharmacy", "Lab", "MRI", "CT Scan", "OPD" },
                { "Emergency", "Pharmacy", "Lab", "Physiotherapy", "Dialysis", "OPD" },
                { "ICU", "Emergency", "Pharmacy", "Lab", "OPD", "Cardiology Lab", "Ambulance" },
                { "Pharmacy", "Lab", "OPD", "Pediatric Ward", "Vaccination Center" }
        };

        String[][] doctorTypesPool = {
                { "Cardiologist", "Neurologist", "Orthopedic", "General Physician", "Pediatrician" },
                { "Dermatologist", "ENT", "Ophthalmologist", "General Physician", "Gynecologist" },
                { "Urologist", "Nephrologist", "Pulmonologist", "General Physician" },
                { "Oncologist", "Cardiologist", "General Physician", "Surgeon" },
                { "Pediatrician", "Gynecologist", "Dermatologist", "General Physician" }
        };

        String[] imagesPool = {
                "[\"https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800\"]",
                "[\"https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800\"]",
                "[\"https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800\"]",
                "[\"https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800\"]",
                "[\"https://images.unsplash.com/photo-1551076805-e1869033e561?w=800\"]"
        };

        int count = 4; // Start from HSP04 since HSP01-03 exist
        for (int c = 0; c < cities.length; c++) {
            String city = cities[c];
            String state = states[c];
            double centerLat = centers[c][0];
            double centerLon = centers[c][1];

            for (int i = 1; i <= 10; i++) {
                String prefix = namePrefixes[(c * 10 + i) % namePrefixes.length];
                String suffix = nameSuffixes[(c * 10 + i) % nameSuffixes.length];
                String name = prefix + " " + suffix;

                double latOffset = (i - 5.5) * 0.008;
                double lonOffset = ((i * 3) % 7 - 3) * 0.008;

                double latitude = centerLat + latOffset;
                double longitude = centerLon + lonOffset;

                int totalBeds = 80 + (i * 15);
                int availableBeds = 10 + ((i * 7) % 35);
                double rating = 3.8 + (double) ((i * 3) % 13) / 10.0;
                if (rating > 5.0)
                    rating = 5.0;

                BigDecimal rate = new BigDecimal(300 + (i * 50));

                String regNo = "HSP" + String.format("%02d", count++);

                int poolIndex = (c * 10 + i) % 5;
                String facilities = "[\"" + String.join("\",\"", facilitiesPool[poolIndex]) + "\"]";
                String[] fullDoctorTypes = {
                    "Dermatologist", "ENT Specialist", "Ophthalmologist", "Gynecologist", "Urologist", "General Physician", "Cardiologist", "Neurologist", "Pediatrician"
                };
                String doctorTypes = "[\"" + String.join("\",\"", fullDoctorTypes) + "\"]";
                String images = imagesPool[poolIndex];

                String description = name + " is a state-of-the-art facility located in " + city + ", " + state +
                        ". We offer comprehensive care in " + String.join(", ", fullDoctorTypes) +
                        " with specialized services including " + String.join(", ", facilitiesPool[poolIndex]) + ".";

                String[] hospitalTypes = {"Government Hospital", "Private Hospital", "NGO-run Hospital", "Clinic"};
                String type = hospitalTypes[(c * 10 + i) % hospitalTypes.length];

                Hospital hospital = Hospital.builder()
                        .registrationNo(regNo)
                        .hospitalType(type)
                        .name(name)
                        .address("Sector " + (i * 2) + ", " + city)
                        .city(city)
                        .state(state)
                        .pincode(String.format("%06d", 110000 + (c * 1000) + i))
                        .phone("+91 998877" + String.format("%04d", count))
                        .email("contact@" + prefix.toLowerCase().replace(" ", "") + ".com")
                        .latitude(latitude)
                        .longitude(longitude)
                        .images(images)
                        .facilities(facilities)
                        .doctorTypes(doctorTypes)
                        .totalBeds(totalBeds)
                        .availableBeds(availableBeds)
                        .consultationRate(rate)
                        .doctor(doctor)
                        .rating(rating)
                        .verified(true)
                        .description(description)
                        .build();
                Hospital savedHospital = hospitalRepository.save(hospital);
                seedDoctorsForHospital(savedHospital, new String[]{"Dermatologist", "ENT Specialist", "Ophthalmologist", "Gynecologist", "Urologist", "General Physician", "Cardiologist", "Neurologist"});
            }
        }
    }

    private void seedDoctorsForHospital(Hospital hospital, String[] unusedSpecPool) {
        String[] docFirstNames = {"Sunita", "Rohan", "Karan", "Pooja", "Arjun", "Meera", "Aditya", "Amit", "Suresh"};
        String[] docLastNames = {"Kumar", "Patel", "Gupta", "Mehta", "Singh", "Joshi", "Rao", "Nair", "Iyer"};
        String[] specPool = {"Dermatologist", "ENT Specialist", "Ophthalmologist", "Gynecologist", "Urologist", "General Physician", "Cardiologist", "Neurologist", "Pediatrician"};
        double[] ratingPool = {4.7, 4.8, 4.9, 5.0, 3.8, 3.9, 4.0, 4.1, 4.5};
        String[] docAvatars = {
            "https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&w=150&q=80", // Sunita (Female)
            "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=150&q=80", // Rohan (Male)
            "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=150&q=80", // Karan (Male)
            "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=150&q=80", // Pooja (Female)
            "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=150&q=80", // Arjun (Male)
            "https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?auto=format&fit=crop&w=150&q=80", // Meera (Female)
            "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=150&q=80", // Aditya (Male)
            "https://images.unsplash.com/photo-1622902046580-2b47f47f0471?auto=format&fit=crop&w=150&q=80", // Amit (Male)
            "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=150&q=80"  // Suresh (Male)
        };

        String[] daysOptions = {"Mon-Fri", "Mon-Sat", "Mon-Thu", "Fri-Sun"};
        String[] hoursOptions = {"09:00 AM - 05:00 PM", "10:00 AM - 04:00 PM", "08:00 AM - 02:00 PM", "02:00 PM - 08:00 PM"};

        for (int d = 0; d < 9; d++) {
            int nameIdx = (d + (int)(long)hospital.getId()) % docFirstNames.length;
            String docName = "Dr. " + docFirstNames[nameIdx] + " " + docLastNames[nameIdx];
            String docEmail = "doctor." + hospital.getRegistrationNo().toLowerCase() + "." + d + "@mediverse.com";
            String spec = specPool[d % specPool.length];
            double docRating = ratingPool[nameIdx];

            User doc = User.builder()
                    .name(docName)
                    .email(docEmail)
                    .password(encodedPassword)
                    .phone("+91 998877" + String.format("%04d", hospital.getId() * 100 + d))
                    .role(User.Role.DOCTOR)
                    .hospitalId(hospital.getId())
                    .specialization(spec)
                    .workingHours(hoursOptions[(d + (int)(long)hospital.getId()) % hoursOptions.length])
                    .workingDays(daysOptions[(d + (int)(long)hospital.getId()) % daysOptions.length])
                    .inPersonConsultation(true)
                    .onlineConsultation(d % 2 == 0)
                    .fees(String.valueOf(300 + (d * 100)))
                    .rating(docRating)
                    .city(hospital.getCity())
                    .address(hospital.getAddress())
                    .avatarUrl(docAvatars[nameIdx])
                    .build();
            userRepository.save(doc);
        }
    }
}
